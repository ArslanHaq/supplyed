"use client";
import type { ComponentProps } from "react";
import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { dropdownOptions, type DropdownName } from "@/features/dropdowns/types";
import { MultiSelectDropdown, SelectDropdown } from "./OptionDropdowns";

export function DropdownStatus({ name }: { name: DropdownName }) {
  const query = useDropdown(name);
  if (query.isError) return <div role="alert" className="mt-2 rounded-lg border border-warning/20 bg-warning-tint p-3 text-sm text-warning">Choices are temporarily unavailable. Your entries have been kept. <button type="button" className="font-semibold underline" onClick={() => void query.refetch()}>Try again</button></div>;
  if (!query.data) return <p role="status" className="mt-2 text-xs text-muted">Loading choices…</p>;
  if (!query.data.options.length) return <p role="status" className="mt-2 text-xs text-muted">No choices are currently available.</p>;
  return null;
}
type SingleProps = Omit<ComponentProps<typeof SelectDropdown>, "options"> & { collection: DropdownName; emptyLabel?: string };
type MultiProps = Omit<ComponentProps<typeof MultiSelectDropdown>, "options"> & { collection: DropdownName };
export function DynamicSelect({ collection, emptyLabel, ...props }: SingleProps) {
  const query = useDropdown(collection);
  const options = dropdownOptions(query.data);
  const missing = Boolean(query.data && props.value && !options.some(option => option.value === props.value));
  return <div><SelectDropdown {...props} options={[...(emptyLabel !== undefined ? [{ label: emptyLabel, value: "" }] : []), ...options]} disabled={props.disabled || !query.data || query.isError} />
    {missing ? <p className="mt-2 text-xs text-warning">Saved selection: {props.value}. This choice is no longer available; review before changing it.</p> : null}<DropdownStatus name={collection} /></div>;
}
export function DynamicMultiSelect({ collection, ...props }: MultiProps) {
  const query = useDropdown(collection);
  const options = dropdownOptions(query.data);
  const missing = query.data ? props.value.filter(value => !options.some(option => option.value === value)) : [];
  return <div><MultiSelectDropdown {...props} options={options} disabled={props.disabled || !query.data || query.isError} />
    {missing.map(value => <div key={value} className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-warning-tint p-2 text-xs text-warning"><span>{value} — saved choice needs review</span><button type="button" disabled={props.disabled} className="underline" onClick={() => props.onChange(props.value.filter(item => item !== value))}>Remove</button></div>)}<DropdownStatus name={collection} /></div>;
}
