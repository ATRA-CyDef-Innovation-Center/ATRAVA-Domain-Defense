var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
function Empty(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<div data-slot="empty" className={cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12', className)} {...props}/>);
}
function EmptyHeader(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<div data-slot="empty-header" className={cn('flex max-w-sm flex-col items-center gap-2 text-center', className)} {...props}/>);
}
const emptyMediaVariants = cva('flex shrink-0 items-center justify-center mb-2 [&_svg]:pointer-events-none [&_svg]:shrink-0', {
    variants: {
        variant: {
            default: 'bg-transparent',
            icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
        },
    },
    defaultVariants: {
        variant: 'default',
    },
});
function EmptyMedia(_a) {
    var { className, variant = 'default' } = _a, props = __rest(_a, ["className", "variant"]);
    return (<div data-slot="empty-icon" data-variant={variant} className={cn(emptyMediaVariants({ variant, className }))} {...props}/>);
}
function EmptyTitle(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<div data-slot="empty-title" className={cn('text-lg font-medium tracking-tight', className)} {...props}/>);
}
function EmptyDescription(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<div data-slot="empty-description" className={cn('text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4', className)} {...props}/>);
}
function EmptyContent(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<div data-slot="empty-content" className={cn('flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance', className)} {...props}/>);
}
export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia, };
