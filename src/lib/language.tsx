"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAccountPreferences } from "@/lib/account-preferences";

export const LANGUAGE_STORAGE_KEY = "tenops_language";

export type Language = "en" | "es";

const english = {
  "nav.dashboard": "Dashboard",
  "nav.preProduction": "Pre-Production",
  "nav.myWork": "My Work",
  "nav.reporting": "Reporting",
  "nav.inventory": "Inventory",
  "nav.purchasing": "Purchasing",
  "nav.settings": "Settings",
  "nav.manpower": "Manpower",
  "nav.manpowerDescription": "Record daily labor and task assignments",
  "nav.materialUsage": "Material Usage",
  "nav.materialUsageDescription": "Record materials consumed by production",
  "nav.dailyProduction": "Daily Production",
  "nav.dailyProductionDescription": "Future daily production reporting",
  "nav.currentInventory": "Current Inventory",
  "nav.currentInventoryDescription": "Review stock, lots, locations, and reservations",
  "nav.pendingReceivals": "Pending Receivals",
  "nav.pendingReceivalsDescription": "Review material awaiting physical receipt",
  "nav.activity": "Activity",
  "nav.activityDescription": "Review Inventory transaction history",
  "nav.purchaseOrders": "Purchase Orders",
  "nav.purchaseOrdersDescription": "Create and manage purchasing drafts",
  "nav.catalog": "Catalog",
  "nav.catalogDescription": "Maintain Inventory and purchasing references",
  "shell.operationsControl": "Operations Control",
  "shell.goToDashboard": "Go to dashboard",
  "shell.logout": "Logout",
  "settings.eyebrow": "Administration",
  "settings.title": "Settings",
  "settings.description": "Operational configuration remains with the module that owns it.",
  "settings.appearance": "Appearance",
  "settings.theme": "Theme",
  "settings.themeDescription": "Choose your preferred TenOps appearance.",
  "settings.light": "Light",
  "settings.dark": "Dark",
  "settings.displaySize": "Display Size",
  "settings.displayDescription": "Adjust text size and interface density across TenOps. Documents and generated PDFs are not affected.",
  "settings.compact": "Compact",
  "settings.compactDescription": "More information on screen with tighter controls and rows.",
  "settings.default": "Default",
  "settings.defaultDescription": "The standard TenOps text size and interface density.",
  "settings.large": "Large",
  "settings.largeDescription": "Larger text, controls, and spacing for easier reading.",
  "settings.browserOnly": "This preference is stored only in this browser.",
  "settings.accountPreference": "Follows your account across devices.",
  "settings.language": "Language",
  "settings.languageDescription": "Translate the TenOps interface. Operational data and generated documents remain unchanged.",
  "settings.english": "English",
  "settings.spanish": "Español",
  "settings.vendors": "Vendors & Contacts",
  "settings.vendorsDescription": "Open Purchasing to maintain Vendor profiles and contacts.",
  "settings.workers": "Workers & Tasks",
  "settings.workersDescription": "Open Manpower Reporting to maintain labor references.",
} as const;

export type TranslationKey = keyof typeof english;

const spanish: Record<TranslationKey, string> = {
  "nav.dashboard": "Panel",
  "nav.preProduction": "Preproducción",
  "nav.myWork": "Mi trabajo",
  "nav.reporting": "Reportes",
  "nav.inventory": "Inventario",
  "nav.purchasing": "Compras",
  "nav.settings": "Configuración",
  "nav.manpower": "Mano de obra",
  "nav.manpowerDescription": "Registrar trabajo y asignaciones diarias",
  "nav.materialUsage": "Uso de materiales",
  "nav.materialUsageDescription": "Registrar materiales consumidos en producción",
  "nav.dailyProduction": "Producción diaria",
  "nav.dailyProductionDescription": "Futuro reporte de producción diaria",
  "nav.currentInventory": "Inventario actual",
  "nav.currentInventoryDescription": "Revisar existencias, lotes, ubicaciones y reservas",
  "nav.pendingReceivals": "Recepciones pendientes",
  "nav.pendingReceivalsDescription": "Revisar material pendiente de recepción física",
  "nav.activity": "Actividad",
  "nav.activityDescription": "Revisar el historial de movimientos de inventario",
  "nav.purchaseOrders": "Órdenes de compra",
  "nav.purchaseOrdersDescription": "Crear y administrar borradores de compra",
  "nav.catalog": "Catálogo",
  "nav.catalogDescription": "Mantener referencias de inventario y compras",
  "shell.operationsControl": "Control de operaciones",
  "shell.goToDashboard": "Ir al panel",
  "shell.logout": "Cerrar sesión",
  "settings.eyebrow": "Administración",
  "settings.title": "Configuración",
  "settings.description": "La configuración operativa permanece en el módulo responsable.",
  "settings.appearance": "Apariencia",
  "settings.theme": "Tema",
  "settings.themeDescription": "Elige tu apariencia preferida de TenOps.",
  "settings.light": "Claro",
  "settings.dark": "Oscuro",
  "settings.displaySize": "Tamaño de interfaz",
  "settings.displayDescription": "Ajusta el tamaño del texto y la densidad de TenOps. Los documentos y PDF generados no cambian.",
  "settings.compact": "Compacto",
  "settings.compactDescription": "Muestra más información con controles y filas más ajustados.",
  "settings.default": "Predeterminado",
  "settings.defaultDescription": "El tamaño y la densidad estándar de TenOps.",
  "settings.large": "Grande",
  "settings.largeDescription": "Texto, controles y espacios más grandes para facilitar la lectura.",
  "settings.browserOnly": "Esta preferencia se guarda únicamente en este navegador.",
  "settings.accountPreference": "Sigue a tu cuenta en todos tus dispositivos.",
  "settings.language": "Idioma",
  "settings.languageDescription": "Traduce la interfaz de TenOps. Los datos operativos y documentos generados no cambian.",
  "settings.english": "English",
  "settings.spanish": "Español",
  "settings.vendors": "Proveedores y contactos",
  "settings.vendorsDescription": "Abre Compras para administrar proveedores y contactos.",
  "settings.workers": "Trabajadores y tareas",
  "settings.workersDescription": "Abre Reportes de mano de obra para administrar referencias laborales.",
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (value: Language) => void;
  t: (key: TranslationKey) => string;
  tr: (englishText: string, spanishText: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "es";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const accountPreferences = useAccountPreferences();
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = accountPreferences.accountScoped
        ? accountPreferences.preferences.language
        : window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      const next = isLanguage(stored) ? stored : "en";
      document.documentElement.lang = next;
      setLanguageState(next);
    }, 0);

    function syncLanguage(event: StorageEvent) {
      if (!accountPreferences.accountScoped && event.key === LANGUAGE_STORAGE_KEY && isLanguage(event.newValue)) {
        document.documentElement.lang = event.newValue;
        setLanguageState(event.newValue);
      }
    }

    window.addEventListener("storage", syncLanguage);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("storage", syncLanguage);
    };
  }, [accountPreferences.accountScoped, accountPreferences.preferences.language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (next) => {
        if (accountPreferences.accountScoped) void accountPreferences.setPreference("language", next);
        else window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
        document.documentElement.lang = next;
        setLanguageState(next);
      },
      t: (key) => (language === "es" ? spanish[key] : english[key]),
      tr: (englishText, spanishText) => language === "es" ? spanishText : englishText,
    }),
    [accountPreferences, language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider.");
  return context;
}
