const { z } = require('zod');

const phoneRegex = /^\+?[\d\s\-()]{9,20}$/;

const phoneSchema = z
  .string()
  .trim()
  .min(9)
  .max(20)
  .regex(phoneRegex, 'Invalid phone format')
  .refine((v) => {
    const digits = v.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 15;
  }, 'Phone must contain 9–15 digits');

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'time must be HH:MM');

const linkTokenSchema = z
  .string()
  .regex(/^[a-f0-9]{32}$/, 'invalid booking token');

const createBookingSchema = z.object({
  service_id: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  master_id: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === null || v === undefined || v === '' ? null : Number(v))),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  start_time: timeSchema,
  client_name: z.string().trim().min(1, 'client_name is required').max(100),
  client_phone: phoneSchema,
  client_email: z
    .union([z.string().email(), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null ? null : v)),
  comment: z
    .union([z.string().max(1000), z.null()])
    .optional()
    .transform((v) => (v === null || v === undefined ? null : v)),
});

const listBookingsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
  phone: z.string().trim().min(1).max(20).optional(),
});

const patchBookingSchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    start_time: timeSchema.optional(),
    master_id: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .transform((v) => (v === null || v === undefined || v === '' ? null : Number(v))),
    comment: z.union([z.string().max(1000), z.null()]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

const createServiceSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100),
  duration_minutes: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0 && v <= 24 * 60, {
      message: 'duration_minutes must be a positive integer (1..1440)',
    }),
  price: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v >= 0, {
      message: 'price must be a non-negative number',
    }),
  is_active: z.boolean().optional().default(true),
});

const updateServiceSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    duration_minutes: z
      .union([z.string(), z.number()])
      .transform((v) => Number(v))
      .refine((v) => Number.isInteger(v) && v > 0 && v <= 24 * 60, {
        message: 'duration_minutes must be a positive integer (1..1440)',
      })
      .optional(),
    price: z
      .union([z.string(), z.number()])
      .transform((v) => Number(v))
      .refine((v) => Number.isFinite(v) && v >= 0, {
        message: 'price must be a non-negative number',
      })
      .optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

const createMasterSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100),
  is_active: z.boolean().optional().default(true),
});

const updateMasterSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

const updateWorkingHoursSchema = z
  .object({
    open_time: timeSchema.optional(),
    close_time: timeSchema.optional(),
    is_day_off: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.is_day_off === false) {
      if (!v.open_time) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['open_time'], message: 'open_time is required when is_day_off is false' });
      }
      if (!v.close_time) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['close_time'], message: 'close_time is required when is_day_off is false' });
      }
      if (v.open_time && v.close_time && v.open_time >= v.close_time) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['close_time'], message: 'close_time must be greater than open_time' });
      }
    }
  });

const updateMasterWorkingHoursSchema = updateWorkingHoursSchema;

// --- Портфолио ---

const tagsSchema = z
  .union([z.string(), z.array(z.string()), z.null()])
  .optional()
  .transform((v) => {
    if (v == null || v === '') return null;
    if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean).join(',');
    return String(v).split(',').map((s) => s.trim()).filter(Boolean).join(',');
  });

const createPortfolioSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(120),
  description: z.union([z.string().max(2000), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v == null ? null : v)),
  image_url: z.string().trim().url('image_url must be a valid URL').max(500),
  service_id: z.union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === null || v === undefined || v === '' ? null : Number(v))),
  tags: tagsSchema,
  price_hint: z.union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }),
  sort_order: z.union([z.string(), z.number()]).optional().transform((v) => {
    const n = Number(v);
    return Number.isInteger(n) ? n : 0;
  }),
  is_active: z.boolean().optional().default(true),
});

const updatePortfolioSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.union([z.string().max(2000), z.literal(''), z.null()]).optional(),
    image_url: z.string().trim().url().max(500).optional(),
    service_id: z.union([z.string(), z.number(), z.null()]).optional()
      .transform((v) => (v === null || v === undefined || v === '' ? null : Number(v))),
    tags: tagsSchema,
    price_hint: z.union([z.string(), z.number(), z.null()]).optional()
      .transform((v) => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : null;
      }),
    sort_order: z.union([z.string(), z.number()]).optional().transform((v) => {
      const n = Number(v);
      return Number.isInteger(n) ? n : 0;
    }),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

const listPortfolioQuerySchema = z.object({
  tag: z.string().trim().max(50).optional(),
});

module.exports = {
  createBookingSchema,
  listBookingsQuerySchema,
  patchBookingSchema,
  createServiceSchema,
  updateServiceSchema,
  createMasterSchema,
  updateMasterSchema,
  updateWorkingHoursSchema,
  updateMasterWorkingHoursSchema,
  createPortfolioSchema,
  updatePortfolioSchema,
  listPortfolioQuerySchema,
  phoneRegex,
  timeSchema,
  linkTokenSchema,
};