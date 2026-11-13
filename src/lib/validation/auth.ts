import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email quá dài')
  .email('Email không đúng định dạng hợp lệ');

const newPassword = z
  .string()
  .min(6, 'Mật khẩu phải có ít nhất 6 ký tự')
  .max(128, 'Mật khẩu tối đa 128 ký tự');

// .strict() rejects unknown keys, so role, userId or status cannot be injected from the client.
export const registerSchema = z
  .object({
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })
  .refine((data) => data.password.toLowerCase() !== data.email.toLowerCase(), {
    message: 'Mật khẩu không được trùng với địa chỉ email',
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
