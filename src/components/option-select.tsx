"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type SelectOption = { value: string; label: string; description?: string }
type Props = {
  id?: string
  value: string
  options: SelectOption[]
  disabled?: boolean
  onValueChange: (value: string) => void
  "aria-label"?: string
  "aria-describedby"?: string
}

export function OptionSelect({id,value,options,disabled,onValueChange,...aria}:Props){
  return <Select items={options.map(option=>({value:option.value,label:option.label}))} value={value} disabled={disabled} onValueChange={next=>{if(next!==null)onValueChange(next)}}>
    <SelectTrigger id={id} {...aria}><SelectValue className="ui-select-value"/></SelectTrigger>
    <SelectContent>{options.map(option=><SelectItem key={option.value} value={option.value} description={option.description}>{option.label}</SelectItem>)}</SelectContent>
  </Select>
}
