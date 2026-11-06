import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .email('Email is not valid');

const newPassword = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters');

// .strict() rejects unknown keys, so role, userId or status cannot be injected from the client.
export const registerSchema = z
  .object({
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.password.toLowerCase() !== data.email, {
    message: 'Password must not be the same as the email',
    path: ['password'],
  });

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1, 'Password is required').max(128),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
