'use client';
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
import { useMemo } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
function FieldSet(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<fieldset data-slot="field-set" className={cn('flex flex-col gap-6', 'has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3', className)} {...props}/>);
}
function FieldLegend(_a) {
    var { className, variant = 'legend' } = _a, props = __rest(_a, ["className", "variant"]);
    return (<legend data-slot="field-legend" data-variant={variant} className={cn('mb-3 font-medium', 'data-[variant=legend]:text-base', 'data-[variant=label]:text-sm', className)} {...props}/>);
}
function FieldGroup(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<div data-slot="field-group" className={cn('group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4', className)} {...props}/>);
}
const fieldVariants = cva('group/field flex w-full gap-3 data-[invalid=true]:text-destructive', {
    variants: {
        orientation: {
            vertical: ['flex-col [&>*]:w-full [&>.sr-only]:w-auto'],
            horizontal: [
                'flex-row items-center',
                '[&>[data-slot=field-label]]:flex-auto',
                'has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
            ],
            responsive: [
                'flex-col [&>*]:w-full [&>.sr-only]:w-auto @md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto',
                '@md/field-group:[&>[data-slot=field-label]]:flex-auto',
                '@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
            ],
        },
    },
    defaultVariants: {
        orientation: 'vertical',
    },
});
function Field(_a) {
    var { className, orientation = 'vertical' } = _a, props = __rest(_a, ["className", "orientation"]);
    return (<div role="group" data-slot="field" data-orientation={orientation} className={cn(fieldVariants({ orientation }), className)} {...props}/>);
}
function FieldContent(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<div data-slot="field-content" className={cn('group/field-content flex flex-1 flex-col gap-1.5 leading-snug', className)} {...props}/>);
}
function FieldLabel(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<Label data-slot="field-label" className={cn('group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50', 'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4', 'has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-primary/10', className)} {...props}/>);
}
function FieldTitle(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<div data-slot="field-label" className={cn('flex w-fit items-center gap-2 text-sm leading-snug font-medium group-data-[disabled=true]/field:opacity-50', className)} {...props}/>);
}
function FieldDescription(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<p data-slot="field-description" className={cn('text-muted-foreground text-sm leading-normal font-normal group-has-[[data-orientation=horizontal]]/field:text-balance', 'last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5', '[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4', className)} {...props}/>);
}
function FieldSeparator(_a) {
    var { children, className } = _a, props = __rest(_a, ["children", "className"]);
    return (<div data-slot="field-separator" data-content={!!children} className={cn('relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2', className)} {...props}>
      <Separator className="absolute inset-0 top-1/2"/>
      {children && (<span className="bg-background text-muted-foreground relative mx-auto block w-fit px-2" data-slot="field-separator-content">
          {children}
        </span>)}
    </div>);
}
function FieldError(_a) {
    var { className, children, errors } = _a, props = __rest(_a, ["className", "children", "errors"]);
    const content = useMemo(() => {
        var _a;
        if (children) {
            return children;
        }
        if (!errors) {
            return null;
        }
        if (errors.length === 1 && ((_a = errors[0]) === null || _a === void 0 ? void 0 : _a.message)) {
            return errors[0].message;
        }
        return (<ul className="ml-4 flex list-disc flex-col gap-1">
        {errors.map((error, index) => (error === null || error === void 0 ? void 0 : error.message) && <li key={index}>{error.message}</li>)}
      </ul>);
    }, [children, errors]);
    if (!content) {
        return null;
    }
    return (<div role="alert" data-slot="field-error" className={cn('text-destructive text-sm font-normal', className)} {...props}>
      {content}
    </div>);
}
export { Field, FieldLabel, FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSeparator, FieldSet, FieldContent, FieldTitle, };
