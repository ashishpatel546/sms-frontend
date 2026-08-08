import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { isValidElement } from 'react';

import { cn } from '@/lib/utils';

/**
 * BUTTONS
 *
 * Lapis is the one thing to do next on a screen — never two. Marigold is
 * reserved for actions that clear a backlog ("Approve 6 leaves"), the only
 * case where a second call to action is honest.
 *
 * A control says exactly what happens when it is used: "Record payment", not
 * "Submit", and it keeps that name through the whole flow.
 *
 * Sizes bottom out at 36px and default to 40px so a touch target clears 44px
 * with its surrounding gap.
 */
const buttonVariants = cva(
  [
    'group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5',
    'rounded-md border border-transparent font-semibold whitespace-nowrap',
    'transition-all duration-150 outline-none select-none',
    'focus-visible:ring-3 focus-visible:ring-brand/40',
    'disabled:pointer-events-none disabled:opacity-50',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(' '),
  {
    variants: {
      variant: {
        /** The one primary action on the screen. */
        primary:
          'bg-brand text-brand-contrast shadow-soft hover:bg-brand-deep hover:-translate-y-px hover:shadow-brand active:translate-y-0',
        /** Kept as an alias so existing `variant="default"` call sites work. */
        default:
          'bg-brand text-brand-contrast shadow-soft hover:bg-brand-deep hover:-translate-y-px hover:shadow-brand active:translate-y-0',
        /** Clearing a backlog. Marigold means "act on this". */
        attn:
          'bg-accent text-accent-contrast shadow-soft hover:-translate-y-px hover:shadow-[0_6px_16px_-4px_rgba(178,106,2,.42)] active:translate-y-0',
        /** Secondary actions that still need an edge. */
        outline:
          'border-line-strong bg-surface text-ink hover:border-brand hover:bg-brand-tint hover:text-brand',
        /** Tertiary — cancel, dismiss, "not now". */
        ghost: 'text-ink-muted hover:bg-surface-secondary hover:text-ink',
        /** Filled neutral, for toolbars sitting on a tinted strip. */
        secondary: 'bg-surface-inset text-ink hover:bg-line-strong',
        /** Destructive. Quiet until hovered, then unmistakable. */
        destructive:
          'border-accent-danger-edge bg-accent-danger-tint text-accent-danger-deep hover:border-accent-danger hover:bg-accent-danger hover:text-white',
        /** On the ink rail or any dark ground. */
        onInk: 'border-white/12 bg-white/8 text-white hover:border-white/25 hover:bg-white/14',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        xs: "h-7 px-2 text-[12px] [&_svg:not([class*='size-'])]:size-3.5",
        sm: 'h-9 px-3 text-[13px]',
        md: 'h-10 px-3.5 text-[13.5px]',
        /** Alias for md, so existing `size="default"` call sites work. */
        default: 'h-10 px-3.5 text-[13.5px]',
        lg: 'h-11 px-5 text-[14.5px]',
        icon: 'size-10',
        'icon-sm': 'size-9',
        'icon-xs': "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        'icon-lg': 'size-11',
      },
      /** Fill the container — mobile action bars and forms. */
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

/**
 * Base UI supplies button semantics (role, keyboard activation) when the thing
 * rendered is not a real `<button>` — but it has to be told. A `render` of a
 * Next `<Link>` or an `<a>` must carry `nativeButton={false}`, or it warns and
 * leaves the element without them. Work that out from the `render` element so
 * call sites never have to remember.
 */
function isNativeButton(render: ButtonPrimitive.Props['render']) {
  return !isValidElement(render) || render.type === 'button';
}

function Button({
  className,
  variant,
  size,
  block,
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      render={render}
      nativeButton={nativeButton ?? isNativeButton(render)}
      className={cn(buttonVariants({ variant, size, block, className }))}
      {...props}
    />
  );
}

/**
 * An icon-only control for toolbars and table rows. `label` is required and
 * becomes both the accessible name and the tooltip — an icon is not a name.
 */
function IconButton({
  label,
  className,
  variant = 'outline',
  size = 'icon-sm',
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { label: string }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      aria-label={label}
      title={label}
      render={render}
      nativeButton={nativeButton ?? isNativeButton(render)}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, IconButton, buttonVariants };
