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
import * as React from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { MinusIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
function InputOTP(_a) {
    var { className, containerClassName } = _a, props = __rest(_a, ["className", "containerClassName"]);
    return (<OTPInput data-slot="input-otp" containerClassName={cn('flex items-center gap-2 has-disabled:opacity-50', containerClassName)} className={cn('disabled:cursor-not-allowed', className)} {...props}/>);
}
function InputOTPGroup(_a) {
    var { className } = _a, props = __rest(_a, ["className"]);
    return (<div data-slot="input-otp-group" className={cn('flex items-center', className)} {...props}/>);
}
function InputOTPSlot(_a) {
    var _b;
    var { index, className } = _a, props = __rest(_a, ["index", "className"]);
    const inputOTPContext = React.useContext(OTPInputContext);
    const { char, hasFakeCaret, isActive } = (_b = inputOTPContext === null || inputOTPContext === void 0 ? void 0 : inputOTPContext.slots[index]) !== null && _b !== void 0 ? _b : {};
    return (<div data-slot="input-otp-slot" data-active={isActive} className={cn('data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 dark:data-[active=true]:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive dark:bg-input/30 border-input relative flex h-9 w-9 items-center justify-center border-y border-r text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px]', className)} {...props}>
      {char}
      {hasFakeCaret && (<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000"/>
        </div>)}
    </div>);
}
function InputOTPSeparator(_a) {
    var props = __rest(_a, []);
    return (<div data-slot="input-otp-separator" role="separator" {...props}>
      <MinusIcon />
    </div>);
}
export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
