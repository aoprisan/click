package main

import (
	"archive/zip"
	"bufio"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

const (
	geonamesURL   = "https://download.geonames.org/export/dump/cities15000.zip"
	dataPath      = "data/cities15000.txt"
	minPopulation = 100_000
)

func seedCities() error {
	if _, err := os.Stat(dataPath); os.IsNotExist(err) {
		if err := downloadGeoNames(); err != nil {
			return fmt.Errorf("download: %w", err)
		}
	}

	cities, err := parseGeoNames(dataPath)
	if err != nil {
		return fmt.Errorf("parse: %w", err)
	}

	log.Printf("Parsed %d cities (pop >= %d or capital)", len(cities), minPopulation)
	return insertCities(cities)
}

func downloadGeoNames() error {
	log.Println("Downloading GeoNames cities15000...")

	resp, err := http.Get(geonamesURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	zipPath := "data/cities15000.zip"
	f, err := os.Create(zipPath)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		return err
	}
	f.Close()

	log.Println("Extracting...")
	return extractTxtFromZip(zipPath)
}

func extractTxtFromZip(zipPath string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		if !strings.HasSuffix(f.Name, ".txt") {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}

		out, err := os.Create(dataPath)
		if err != nil {
			rc.Close()
			return err
		}

		_, err = io.Copy(out, rc)
		rc.Close()
		out.Close()
		if err != nil {
			return err
		}
		log.Printf("Extracted %s", f.Name)
		return nil
	}
	return fmt.Errorf("no .txt found in zip")
}

func slugify(name, countryCode string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	result, _, _ := transform.String(t, name)

	result = strings.ToLower(result)
	var b strings.Builder
	for _, r := range result {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
		} else if r == ' ' || r == '-' {
			b.WriteRune('-')
		}
	}
	slug := strings.Trim(b.String(), "-")
	for strings.Contains(slug, "--") {
		slug = strings.ReplaceAll(slug, "--", "-")
	}
	return slug + "-" + strings.ToLower(countryCode)
}

// parseGeoNames reads the GeoNames tab-delimited format.
// Columns: geonameid, name, asciiname, alternatenames, latitude, longitude,
// feature class, feature code, country code, cc2, admin1, admin2,
// admin3, admin4, population, elevation, dem, timezone, modification date
func parseGeoNames(path string) ([]City, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	countryNames := loadCountryNames()

	seen := map[string]bool{}
	var cities []City
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	for scanner.Scan() {
		fields := strings.Split(scanner.Text(), "\t")
		if len(fields) < 15 {
			continue
		}

		pop, _ := strconv.Atoi(fields[14])
		featureCode := fields[7]
		isCapital := featureCode == "PPLC"

		if pop < minPopulation && !isCapital {
			continue
		}

		name := fields[1]
		asciiName := fields[2]
		lat, _ := strconv.ParseFloat(fields[4], 64)
		lng, _ := strconv.ParseFloat(fields[5], 64)
		countryCode := fields[8]

		if asciiName == "" {
			asciiName = name
		}

		country := countryNames[countryCode]
		if country == "" {
			country = countryCode
		}

		slug := slugify(asciiName, countryCode)
		if seen[slug] {
			slug = slug + "-2"
		}
		if seen[slug] {
			continue
		}
		seen[slug] = true

		cities = append(cities, City{
			ID:          slug,
			Name:        name,
			Country:     country,
			CountryCode: countryCode,
			Lat:         lat,
			Lng:         lng,
		})
	}

	return cities, scanner.Err()
}

func loadCountryNames() map[string]string {
	path := "data/countryInfo.txt"
	if _, err := os.Stat(path); os.IsNotExist(err) {
		downloadCountryInfo(path)
	}

	names := map[string]string{}
	f, err := os.Open(path)
	if err != nil {
		return names
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Split(line, "\t")
		if len(fields) >= 5 {
			names[fields[0]] = fields[4]
		}
	}
	return names
}

func downloadCountryInfo(path string) {
	resp, err := http.Get("https://download.geonames.org/export/dump/countryInfo.txt")
	if err != nil {
		return
	}
	defer resp.Body.Close()
	f, err := os.Create(path)
	if err != nil {
		return
	}
	defer f.Close()
	io.Copy(f, resp.Body)
}

func insertCities(cities []City) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT OR IGNORE INTO cities (id, name, country, country_code, lat, lng) VALUES (?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, c := range cities {
		if _, err := stmt.Exec(c.ID, c.Name, c.Country, c.CountryCode, c.Lat, c.Lng); err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Printf("Inserted %d cities into database", len(cities))
	return nil
}
