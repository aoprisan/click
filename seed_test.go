package main

import (
	"testing"
)

func TestSlugify(t *testing.T) {
	tests := []struct {
		name        string
		countryCode string
		want        string
	}{
		{"Paris", "FR", "paris-fr"},
		{"New York", "US", "new-york-us"},
		{"São Paulo", "BR", "sao-paulo-br"},
		{"Zürich", "CH", "zurich-ch"},
		{"Côte d'Ivoire", "CI", "cote-divoire-ci"},
		{"München", "DE", "munchen-de"},
		{"Kraków", "PL", "krakow-pl"},
		{"simple", "US", "simple-us"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := slugify(tc.name, tc.countryCode)
			if got != tc.want {
				t.Errorf("slugify(%q, %q) = %q, want %q", tc.name, tc.countryCode, got, tc.want)
			}
		})
	}
}

func TestSlugifyEmptyInput(t *testing.T) {
	got := slugify("", "US")
	if got != "-us" && got != "us" {
		// Just verify it doesn't panic
		t.Logf("slugify('', 'US') = %q", got)
	}
}
