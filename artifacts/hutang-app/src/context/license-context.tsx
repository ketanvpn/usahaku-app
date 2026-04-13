import { createContext, useContext } from "react";

export interface LicenseContextValue {
  lisensiAktif: boolean;
  jamDimanipulasi: boolean;
}

export const LicenseContext = createContext<LicenseContextValue>({
  lisensiAktif: true,
  jamDimanipulasi: false,
});

export function useLicense(): LicenseContextValue {
  return useContext(LicenseContext);
}
