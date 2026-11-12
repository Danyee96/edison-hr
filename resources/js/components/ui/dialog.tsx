import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useModalStack } from "@/contexts/ModalStackContext"
import { lockBodyScroll, unlockBodyScroll } from "@/utils/body-scroll-lock"

const DialogOpenContext = React.createContext(false)

const Dialog = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>
>(({ onOpenChange, open: openProp, defaultOpen = false, ...props }, ref) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isOpen = openProp ?? uncontrolledOpen

  const handleOpenChange = (open: boolean) => {
    if (openProp === undefined) {
      setUncontrolledOpen(open)
    }

    // Only call onOpenChange for explicit close actions, not focus loss
    if (onOpenChange) {
      onOpenChange(open);
    }
  };
  
  return (
    <DialogOpenContext.Provider value={isOpen}>
      <DialogPrimitive.Root
        {...props}
        open={openProp}
        defaultOpen={defaultOpen}
        modal={false}
        onOpenChange={handleOpenChange}
      />
    </DialogOpenContext.Provider>
  );
})
Dialog.displayName = "Dialog"

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & { modalId?: string }
>(({ className, modalId, ...props }, ref) => {
  const { getZIndex, modalStack } = useModalStack();
  const zIndex = modalId ? getZIndex(modalId) : 50;
  const modalIndex = modalStack.indexOf(modalId || '');
  const isFirstModal = modalIndex <= 0;
  
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        isFirstModal ? "bg-black/50" : "bg-black/25",
        className
      )}
      style={{ zIndex }}
      {...props}
    />
  );
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { modalId?: string }
>(({ className, children, modalId, ...props }, ref) => {
  const { registerModal, unregisterModal, getZIndex, modalStack } = useModalStack();
  const isOpen = React.useContext(DialogOpenContext);
  const [currentModalId] = React.useState(() => modalId || `modal-${Date.now()}-${Math.random()}`);
  
  React.useEffect(() => {
    if (!isOpen) return;

    lockBodyScroll();
    registerModal(currentModalId);

    return () => {
      unregisterModal(currentModalId);
      unlockBodyScroll();
    };
  }, [currentModalId, isOpen, registerModal, unregisterModal]);
  
  const zIndex = getZIndex(currentModalId);
  
  return (
    <DialogPortal>
      <DialogOverlay modalId={currentModalId} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] grid max-h-[calc(100svh-1rem)] w-[calc(100%-1rem)] max-w-xl translate-x-[-50%] translate-y-[-50%] gap-5 overflow-y-auto overscroll-contain border bg-background p-4 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:max-h-[calc(100vh-2rem)] sm:w-[calc(100%-2rem)] sm:rounded-lg sm:p-7",
          className
        )}
        style={{ zIndex: zIndex + 1 }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          // Only close if this is the topmost modal
          if (modalStack[modalStack.length - 1] !== currentModalId) {
            e.preventDefault();
          }
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
