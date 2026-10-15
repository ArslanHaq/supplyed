import { useMemo } from "react";
import { City, Country, type ICity } from "country-state-city";

import { Field } from "../../atoms";
import { SelectDropdown } from "../../molecules/OptionDropdowns";

const countryOptions = Country.getAllCountries()
  .sort((first, second) => first.name.localeCompare(second.name))
  .map((country) => ({ label: country.name, value: country.isoCode }));

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
  const cityOptions = useMemo(
    () => uniqueCities(City.getCitiesOfCountry(countryCode) ?? []).map((cityOption) => cityOption.name),
    [countryCode],
  );
  const currentCityInOptions = cityOptions.includes(city);

  return (
    <>
      <Field label="Country" error={countryError} required={countryRequired}>
        <SelectDropdown
          className={countryError ? "border-danger bg-danger-tint" : undefined}
          error={Boolean(countryError)}
          onChange={onCountryChange}
          options={countryOptions}
          placeholder="Select country"
          searchable
          value={countryCode}
        />
      </Field>
      <Field label="City" htmlFor={cityId} error={cityError} required={cityRequired}>
        <SelectDropdown
          className={cityError ? "border-danger bg-danger-tint" : undefined}
          disabled={!countryCode}
          error={Boolean(cityError)}
          id={cityId}
          onChange={onCityChange}
          options={city && !currentCityInOptions ? [city, ...cityOptions] : cityOptions}
          placeholder={countryCode ? "Select city" : "Select country first"}
          searchable
          value={city}
        />
      </Field>
    </>
  );
}