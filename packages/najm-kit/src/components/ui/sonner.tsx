import { Toaster as Sonner, toast, type ToasterProps } from "sonner"

function Toaster({ toastOptions, ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "!border-emerald-500/40 !bg-emerald-600 !text-white [&_[data-description]]:!text-white/80",
          error: "!border-red-500/40 !bg-red-600 !text-white [&_[data-description]]:!text-white/80",
          warning: "!border-amber-500/40 !bg-amber-500 !text-white [&_[data-description]]:!text-white/80",
          info: "!border-cyan-500/40 !bg-cyan-600 !text-white [&_[data-description]]:!text-white/80",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
