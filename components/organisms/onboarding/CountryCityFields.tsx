import { useMemo } from "react";
import { City, Country, type ICity } from "country-state-city";

import { Field } from "../../atoms";

const countryOptions = Country.getAllCountries().sort((first, second) => first.name.localeCompare(second.name));

function uniqueCities(cities: ICity[]) {
  const seen = new Set<string>();

  return cities
    .filter((city) => {
      const key = city.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => first.name.localeCompare(second.name));
}

function selectClass(error?: string) {
  return `select${error ? " border-danger bg-danger-tint" : ""}`;
}

export function CountryCityFields({
  city,
  cityError,
  cityId,
  cityRequired,
  countryCode,
  countryError,
  countryRequired,
  onCityChange,
  onCountryChange,
}: {
  city: string;
  cityError?: string;
  cityId?: string;
  cityRequired?: boolean;
  countryCode: string;
  countryError?: string;
  countryRequired?: boolean;
  onCityChange: (value: string) => void;
  onCountryChange: (value: string) => void;
}) {
  const cityOptions = useMemo(() => uniqueCities(City.getCitiesOfCountry(countryCode) ?? []), [countryCode]);
  const currentCityInOptions = cityOptions.some((option) => option.name === city);

  return (
    <>
      <Field label="Country" error={countryError} required={countryRequired}>
        <select className={selectClass(countryError)} onChange={(event) => onCountryChange(event.target.value)} value={countryCode}>
          <option value="">Select country</option>
          {countryOptions.map((country) => (
            <option key={country.isoCode} value={country.isoCode}>
              {country.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="City" htmlFor={cityId} error={cityError} required={cityRequired}>
        <select
          id={cityId}
          className={selectClass(cityError)}
          disabled={!countryCode}
          onChange={(event) => onCityChange(event.target.value)}
          value={city}
        >
          <option value="">{countryCode ? "Select city" : "Select country first"}</option>
          {city && !currentCityInOptions ? <option value={city}>{city}</option> : null}
          {cityOptions.map((cityOption) => (
            <option key={cityOption.name} value={cityOption.name}>
              {cityOption.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}