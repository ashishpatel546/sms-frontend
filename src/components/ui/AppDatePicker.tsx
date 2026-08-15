"use client";

/**
 * AppDatePicker & AppMonthPicker
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop-in replacements for <input type="date"> and <input type="month">.
 * These use MUI x-date-pickers which render a proper calendar dialog/popover
 * on ALL devices (instead of the uncontrollable blue OS-native picker on mobile).
 *
 * Colour is READ FROM THE LIVE CSS VARIABLES rather than kept as a second copy
 * of the palette here. That copy is exactly what went wrong before: it held the
 * violet/navy of a retired design plus a dead `teal` branch, so every calendar
 * in the app was off-palette in a way nothing else was. Reading the tokens
 * means the picker follows both theme axes — light/dark and the palette — with
 * nothing to keep in sync.
 *
 * It has to be read rather than passed straight through as `var(--brand)`:
 * MUI's createTheme computes lighter/darker variants from the palette colours
 * and rejects a `var()` it cannot parse. Only the styleOverrides below could
 * take one, and then half the theme would be tokens and half literals.
 */

import type {} from "@mui/x-date-pickers/themeAugmentation";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { usePalette } from "@/components/providers/PaletteProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { renderTimeViewClock } from "@mui/x-date-pickers/timeViewRenderers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

// ── Colour, read from the app's own tokens ───────────────────────────────────

interface Palette {
  mode: "light" | "dark";
  brand: string;
  brandContrast: string;
  brandAlpha: string;
  surface: string;
  surfaceSec: string;
  ink: string;
  inkMuted: string;
  border: string;
  shadow: string;
}

/** Register & Ink, light. Used on the server and if a token cannot be read. */
const FALLBACK: Palette = {
  mode: "light",
  brand: "#7d4907",
  brandContrast: "#ffffff",
  brandAlpha: "#f7ecd6",
  surface: "#ffffff",
  surfaceSec: "#faf8f3",
  ink: "#211c16",
  inkMuted: "#756d65",
  border: "#e2ddd3",
  shadow: "0 12px 32px -8px rgba(33, 28, 22, 0.18)",
};

function readPalette(isDark: boolean): Palette {
  if (typeof window === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback;
  return {
    mode: isDark ? "dark" : "light",
    brand: read("--brand", FALLBACK.brand),
    brandContrast: read("--brand-contrast", FALLBACK.brandContrast),
    brandAlpha: read("--brand-tint", FALLBACK.brandAlpha),
    surface: read("--surface", FALLBACK.surface),
    surfaceSec: read("--surface-secondary", FALLBACK.surfaceSec),
    ink: read("--ink", FALLBACK.ink),
    inkMuted: read("--ink-muted", FALLBACK.inkMuted),
    border: read("--line", FALLBACK.border),
    shadow: read("--shadow-glass-base", FALLBACK.shadow),
  };
}

/**
 * The live token values, re-read whenever either theme axis moves.
 * `useState` seeds it on the first client render so a picker opened
 * immediately is already correct; the effect covers every later switch.
 */
function useTokenPalette(): Palette {
  const { resolvedTheme } = useTheme();
  const { palette } = usePalette();
  const isDark = resolvedTheme === "dark";
  const [tokens, setTokens] = useState<Palette>(() => readPalette(isDark));

  useEffect(() => {
    setTokens(readPalette(isDark));
  }, [isDark, palette]);

  return tokens;
}

// ── MUI theme factory ────────────────────────────────────────────────────────

function buildMuiTheme(p: Palette) {
  return createTheme({
    palette: {
      mode: p.mode,
      primary: { main: p.brand },
      background: { paper: p.surface, default: p.surface },
      text: { primary: p.ink, secondary: p.inkMuted },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none", backgroundColor: p.surface },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: p.surface,
            backgroundImage: "none",
            borderRadius: "1.25rem",
          },
        },
      },
      MuiPickerDay: {
        styleOverrides: {
          root: {
            color: p.ink,
            borderRadius: "50%",
            /* eslint-disable @typescript-eslint/naming-convention */
            "&.Mui-selected": { backgroundColor: p.brand, color: p.brandContrast },
            "&.Mui-selected:hover": { backgroundColor: p.brand },
            "&.MuiPickerDay-today:not(.Mui-selected)": {
              borderColor: p.brand,
              borderWidth: 2,
            },
            "&:hover:not(.Mui-selected)": { backgroundColor: p.surfaceSec },
          },
        },
      },
      MuiDateCalendar: {
        styleOverrides: {
          root: { backgroundColor: p.surface, color: p.ink, maxHeight: 380 },
        },
      },
      MuiPickersCalendarHeader: {
        styleOverrides: {
          label: { color: p.ink, fontWeight: 700 },
          switchViewButton: { color: p.ink },
          switchViewIcon: { color: p.inkMuted },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { color: p.ink } },
      },
      MuiDayCalendar: {
        styleOverrides: {
          weekDayLabel: { color: p.inkMuted, fontWeight: 600, fontSize: "0.75rem" },
        },
      },
      MuiYearCalendar: {
        styleOverrides: {
          root: { color: p.ink },
          button: {
            color: p.ink,
            "&.Mui-selected": { backgroundColor: p.brand, color: p.brandContrast },
            "&:hover:not(.Mui-selected)": { backgroundColor: p.surfaceSec },
          },
        },
      },
      MuiMonthCalendar: {
        styleOverrides: {
          button: {
            color: p.ink,
            "&.Mui-selected": { backgroundColor: p.brand, color: p.brandContrast },
            "&:hover:not(.Mui-selected)": { backgroundColor: p.surfaceSec },
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            backgroundColor: p.surface,
            "& .MuiButton-root": { color: p.brand, fontWeight: 600 },
          },
        },
      },
    },
  });
}

// ── Shared text-field sx ─────────────────────────────────────────────────────

function buildTextFieldSx(p: Palette) {
  return {
    width: "100%",
    "& .MuiOutlinedInput-root": {
      backgroundColor: p.surface,
      borderRadius: "0.5rem",
      color: p.ink,
      fontSize: "0.875rem",
      "& fieldset": { borderColor: p.border },
      "&:hover fieldset": { borderColor: p.brand },
      "&.Mui-focused fieldset": { borderColor: p.brand, borderWidth: "2px" },
      "&.Mui-disabled": { opacity: 0.55 },
    },
    "& .MuiInputBase-input": {
      padding: "8px 14px",
      color: p.ink,
      fontSize: "0.875rem",
      "&.Mui-disabled": { WebkitTextFillColor: p.inkMuted },
    },
    "& .MuiSvgIcon-root": { color: p.brand },
    "& .MuiInputAdornment-root button": {
      color: p.brand,
      "&:hover": { backgroundColor: p.brandAlpha },
    },
  };
}

function popperSx(p: Palette) {
  return {
    "& .MuiPaper-root": {
      boxShadow: p.shadow,
      borderRadius: "0.75rem",
      overflow: "hidden",
      border: `1px solid ${p.border}`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AppDatePicker
// ─────────────────────────────────────────────────────────────────────────────

export interface AppDatePickerProps {
  /** Controlled date string in YYYY-MM-DD format, or '' when unset */
  value: string;
  /** Called with the selected YYYY-MM-DD string, or '' when cleared */
  onChange: (value: string) => void;
  /** Minimum selectable date as YYYY-MM-DD */
  min?: string;
  /** Maximum selectable date as YYYY-MM-DD */
  max?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  /** Optional Tailwind class applied to the outer wrapper div (for layout) */
  className?: string;
}

export function AppDatePicker({
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  name,
  placeholder,
  className,
}: AppDatePickerProps) {
  const palette = useTokenPalette();
  // Only rebuilds when a token actually changed
  const muiTheme = useMemo(() => buildMuiTheme(palette), [palette]);

  const dayjsValue = value ? dayjs(value, "YYYY-MM-DD") : null;
  const minDate = min ? dayjs(min, "YYYY-MM-DD") : undefined;
  const maxDate = max ? dayjs(max, "YYYY-MM-DD") : undefined;

  const handleChange = (newVal: Dayjs | null) => {
    onChange(newVal?.isValid() ? newVal.format("YYYY-MM-DD") : "");
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={muiTheme}>
        <div className={className} style={{ width: "100%" }}>
          <DatePicker
            value={dayjsValue}
            onChange={handleChange}
            minDate={minDate}
            maxDate={maxDate}
            disabled={disabled}
            format="DD/MM/YYYY"
            slotProps={{
              textField: {
                required,
                name,
                size: "small",
                fullWidth: true,
                sx: buildTextFieldSx(palette),
                slotProps: {
                  htmlInput: { placeholder: placeholder ?? "DD/MM/YYYY" },
                },
              },
              popper: { sx: popperSx(palette) },
              dialog: {
                sx: {
                  "& .MuiDialog-paper": { borderRadius: "1.25rem", overflow: "hidden" },
                },
              },
            }}
          />
        </div>
      </ThemeProvider>
    </LocalizationProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppMonthPicker
// ─────────────────────────────────────────────────────────────────────────────

export interface AppMonthPickerProps {
  /** Controlled value in YYYY-MM format, or '' when unset */
  value: string;
  /** Called with the selected YYYY-MM string, or '' when cleared */
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  className?: string;
}

export function AppMonthPicker({
  value,
  onChange,
  required,
  disabled,
  name,
  placeholder,
  className,
}: AppMonthPickerProps) {
  const palette = useTokenPalette();
  const muiTheme = useMemo(() => buildMuiTheme(palette), [palette]);

  // Use day-01 internally so dayjs can parse it
  const dayjsValue = value ? dayjs(`${value}-01`, "YYYY-MM-DD") : null;

  const handleChange = (newVal: Dayjs | null) => {
    onChange(newVal?.isValid() ? newVal.format("YYYY-MM") : "");
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={muiTheme}>
        <div className={className} style={{ width: "100%" }}>
          <DatePicker
            value={dayjsValue}
            onChange={handleChange}
            views={["year", "month"]}
            openTo="month"
            disabled={disabled}
            format="MMMM YYYY"
            slotProps={{
              textField: {
                required,
                name,
                size: "small",
                fullWidth: true,
                sx: buildTextFieldSx(palette),
                slotProps: {
                  htmlInput: { placeholder: placeholder ?? "Select month" },
                },
              },
              popper: { sx: popperSx(palette) },
              dialog: {
                sx: {
                  "& .MuiDialog-paper": { borderRadius: "1.25rem", overflow: "hidden" },
                },
              },
            }}
          />
        </div>
      </ThemeProvider>
    </LocalizationProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppTimePicker
// ─────────────────────────────────────────────────────────────────────────────

export interface AppTimePickerProps {
  /** Controlled time string in HH:mm format, or '' when unset */
  value: string;
  /** Called with the selected HH:mm string, or '' when cleared */
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  /** Optional Tailwind class applied to the outer wrapper div (for layout) */
  className?: string;
}

export function AppTimePicker({
  value,
  onChange,
  required,
  disabled,
  name,
  placeholder,
  className,
}: AppTimePickerProps) {
  const palette = useTokenPalette();
  const muiTheme = useMemo(() => buildMuiTheme(palette), [palette]);

  const dayjsValue = value ? dayjs(`2000-01-01T${value}`) : null;

  const handleChange = (newVal: Dayjs | null) => {
    onChange(newVal?.isValid() ? newVal.format("HH:mm") : "");
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={muiTheme}>
        <div className={className} style={{ width: "100%" }}>
          <TimePicker
            value={dayjsValue}
            onChange={handleChange}
            disabled={disabled}
            ampm={false}
            viewRenderers={{
              hours: renderTimeViewClock,
              minutes: renderTimeViewClock,
            }}
            slotProps={{
              textField: {
                required,
                name,
                size: "small",
                fullWidth: true,
                sx: buildTextFieldSx(palette),
                slotProps: {
                  htmlInput: { placeholder: placeholder ?? "--:--" },
                },
              },
              popper: { sx: popperSx(palette) },
              dialog: {
                sx: {
                  "& .MuiDialog-paper": { borderRadius: "1.25rem", overflow: "hidden" },
                },
              },
            }}
          />
        </div>
      </ThemeProvider>
    </LocalizationProvider>
  );
}
