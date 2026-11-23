"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"

function DialogRoot({
  isOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <DialogPrimitive.Root
      data-slot="confirm-root"
      open={isOpen}
      onOpenChange={onOpenChange}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  title = "Confirmación",
  description = "¿Estás seguro?",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  onCancel?: () => void
}) {
  return (
    <DialogPrimitive.Content
      data-slot="confirm-content"
      className={cn(
        "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-app p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
        className
      )}
    >
      <h2 className="text-center text-lg font-semibold">{title}</h2>
      <p className="text-center text-text-muted">{description}</p>
      <div className="flex gap-2 justify-end">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => onCancel?.()}
        >
          {cancelLabel}
        </Button>
        <Button
          className="flex-1"
          onClick={() => onConfirm?.()}
        >
          {confirmLabel}
        </Button>
      </div>
    </DialogPrimitive.Content>
  )
}

export interface ConfirmDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onCancel: () => void
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
}

export function ConfirmDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel,
  cancelLabel,
}: ConfirmDialogProps) {
  return (
    <DialogRoot
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </DialogRoot>
  )
}