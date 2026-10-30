import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    className="toaster group"
    toastOptions={{
      classNames: {
        toast: "!bg-surface !text-cream !border-line font-mono",
        description: "!text-muted",
      },
    }}
    {...props}
  />
)

export { Toaster }
