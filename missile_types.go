package main

// MissileTypeDef defines the static properties of a missile type.
type MissileTypeDef struct {
	Name        string
	RangeKM     int
	DamageLower int
	DamageUpper int
}

var allMissileTypes = []MissileTypeDef{
	{Name: "Imp I", RangeKM: 500, DamageLower: 300, DamageUpper: 700},
	{Name: "Imp II", RangeKM: 1500, DamageLower: 300, DamageUpper: 700},
	{Name: "Imp III", RangeKM: 5000, DamageLower: 300, DamageUpper: 700},
	{Name: "Titan I", RangeKM: 500, DamageLower: 3000, DamageUpper: 7000},
	{Name: "Titan II", RangeKM: 1500, DamageLower: 3000, DamageUpper: 7000},
	{Name: "Titan III", RangeKM: 5000, DamageLower: 3000, DamageUpper: 7000},
	{Name: "Atlas I", RangeKM: 500, DamageLower: 30000, DamageUpper: 70000},
	{Name: "Atlas II", RangeKM: 1500, DamageLower: 30000, DamageUpper: 70000},
	{Name: "Atlas III", RangeKM: 5000, DamageLower: 30000, DamageUpper: 70000},
}

// Click missile thresholds: clicks → missile type name
var clickMissileThresholds = []struct {
	Clicks int
	Type   string
}{
	{300, "Imp I"},
	{2000, "Imp II"},
	{4000, "Imp III"},
	{6000, "Titan I"},
	{8000, "Titan II"},
	{10000, "Titan III"},
	{13000, "Atlas I"},
	{16000, "Atlas II"},
	{20000, "Atlas III"},
}

func getMissileTypeDef(name string) *MissileTypeDef {
	for _, mt := range allMissileTypes {
		if mt.Name == name {
			return &mt
		}
	}
	return nil
}
