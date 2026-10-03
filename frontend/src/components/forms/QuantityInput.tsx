"use client";

import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { HStack, StackItem } from "@astryxdesign/core/Stack";
import { Minus, Plus } from "lucide-react";

/**
 * A quantity field people can tap. NumberInput's own `hasNumberSteppers` buttons are 15×20px,
 * below the 24px minimum touch target, and they are not themeable. The IconButtons here follow
 * --size-element-*, which the Stone theme raises to 40px on touch screens (32px with a mouse).
 * The field itself still accepts typing, clamped to [min, max].
 */
export function QuantityInput({
  label,
  description,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <HStack gap={2} vAlign="end">
      <StackItem size="fill">
        <NumberInput
          label={label}
          description={description}
          value={value}
          onChange={(next) => onChange(Math.min(max, Math.max(min, next)))}
          min={min}
          max={max}
          isIntegerOnly
        />
      </StackItem>
      <IconButton
        label={`Remove one: ${label}`}
        icon={<Icon icon={Minus} size="sm" />}
        onClick={() => onChange(Math.max(min, value - 1))}
        isDisabled={value <= min}
      />
      <IconButton
        label={`Add one: ${label}`}
        icon={<Icon icon={Plus} size="sm" />}
        onClick={() => onChange(Math.min(max, value + 1))}
        isDisabled={value >= max}
      />
    </HStack>
  );
}
