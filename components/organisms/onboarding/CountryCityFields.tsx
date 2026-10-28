import { DynamicSelect } from "@/components/molecules/DynamicDropdown";
import { UK_COUNTRY_CODE, UK_COUNTRY_NAME, validateUkCity, validateUkCountry } from "@/lib/uk-validation";

import { Field } from "../../atoms";


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
  const countryValidation = validateUkCountry(countryCode, { required: countryRequired });
  const cityValidation = validateUkCity(city, { required: cityRequired });
  const shownCountryError = countryError || (countryCode && !countryValidation.valid ? countryValidation.error : undefined);
  const shownCityError = cityError || (city && !cityValidation.valid ? cityValidation.error : undefined);

  return (
    <>
      <Field label="Country" error={shownCountryError} required={countryRequired} hint="SupplyED currently supports United Kingdom addresses.">
        <DynamicSelect
          error={Boolean(shownCountryError)}
          onChange={onCountryChange}
          collection="country"
          placeholder="Select country"
          value={countryCode}
        />
      </Field>
      <Field label="City / town" htmlFor={cityId} error={shownCityError} required={cityRequired}>
        <DynamicSelect
          id={cityId}
          error={Boolean(shownCityError)}
          disabled={!countryValidation.valid || !countryCode}
          onChange={onCityChange}
          collection="city" emptyLabel="Select city or town"
          placeholder={countryCode ? "Select city" : "Select country first"}
          searchable
          value={city}
        />
      </Field>
    </>
  );
}
