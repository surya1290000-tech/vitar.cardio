'use client';

import Link, { type LinkProps } from 'next/link';
import clsx from 'clsx';
import type React from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'neon' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'btn-p',
  ghost: 'btn-g',
  neon: 'btn-p neon-cta',
  danger: 'btn-p',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'ui-btn--sm',
  md: 'ui-btn--md',
  lg: 'ui-btn--lg',
};

type SharedProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: SharedProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx('ui-btn', variantClass[variant], sizeClass[size], className)}
    />
  );
}

type ButtonLinkProps = SharedProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  LinkProps;

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      {...props}
      className={clsx('ui-btn', variantClass[variant], sizeClass[size], className)}
    />
  );
}
