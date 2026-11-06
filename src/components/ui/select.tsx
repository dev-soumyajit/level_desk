"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// shadcn/ui Base UI composition, with viewport-bounded popup sizing.
const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return <SelectPrimitive.Trigger data-slot="select-trigger" className={cn("ui-select-trigger border-input bg-white text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50", className)} {...props}>
    {children}
    <SelectPrimitive.Icon className="ui-select-icon"><ChevronDown size={16} /></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
}

function SelectContent({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Popup>) {
  return <SelectPrimitive.Portal>
    <SelectPrimitive.Positioner sideOffset={6} align="start" alignItemWithTrigger={false} collisionPadding={12} className="ui-select-positioner">
      <SelectPrimitive.Popup data-slot="select-content" className={cn("ui-select-popup border-border bg-popover text-popover-foreground shadow-lg", className)} {...props}>
        <SelectPrimitive.List className="ui-select-list">{children}</SelectPrimitive.List>
      </SelectPrimitive.Popup>
    </SelectPrimitive.Positioner>
  </SelectPrimitive.Portal>
}

function SelectItem({ className, children, description, ...props }: React.ComponentProps<typeof SelectPrimitive.Item> & { description?: string }) {
  return <SelectPrimitive.Item data-slot="select-item" className={cn("ui-select-item outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50", className)} {...props}>
    <div className="ui-select-item-copy"><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>{description&&<span className="ui-select-description">{description}</span>}</div>
    <SelectPrimitive.ItemIndicator className="ui-select-indicator"><Check size={16}/></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
}

function SelectLabel({className,...props}:React.ComponentProps<typeof SelectPrimitive.GroupLabel>){
  return <SelectPrimitive.GroupLabel data-slot="select-label" className={cn("px-3 py-2 text-xs font-medium text-muted-foreground",className)} {...props}/>
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel }
