/**
 * Dados para dropdowns de localização na busca de lugares (Scraping).
 * textQuery será montado como: "{segmento} em {cidade}, {estadoUF}, {país}"
 */

export interface CountryOption {
  value: string;
  label: string;
}

export interface StateOption {
  value: string; // UF (sigla)
  label: string;
}

export const SCRAPING_COUNTRIES: CountryOption[] = [
  { value: 'Brasil', label: 'Brasil' },
];

export const SCRAPING_STATES_BR: StateOption[] = [
  { value: 'AC', label: 'Acre (AC)' },
  { value: 'AL', label: 'Alagoas (AL)' },
  { value: 'AM', label: 'Amazonas (AM)' },
  { value: 'AP', label: 'Amapá (AP)' },
  { value: 'BA', label: 'Bahia (BA)' },
  { value: 'CE', label: 'Ceará (CE)' },
  { value: 'DF', label: 'Distrito Federal (DF)' },
  { value: 'ES', label: 'Espírito Santo (ES)' },
  { value: 'GO', label: 'Goiás (GO)' },
  { value: 'MA', label: 'Maranhão (MA)' },
  { value: 'MG', label: 'Minas Gerais (MG)' },
  { value: 'MS', label: 'Mato Grosso do Sul (MS)' },
  { value: 'MT', label: 'Mato Grosso (MT)' },
  { value: 'PA', label: 'Pará (PA)' },
  { value: 'PB', label: 'Paraíba (PB)' },
  { value: 'PE', label: 'Pernambuco (PE)' },
  { value: 'PI', label: 'Piauí (PI)' },
  { value: 'PR', label: 'Paraná (PR)' },
  { value: 'RJ', label: 'Rio de Janeiro (RJ)' },
  { value: 'RN', label: 'Rio Grande do Norte (RN)' },
  { value: 'RO', label: 'Rondônia (RO)' },
  { value: 'RR', label: 'Roraima (RR)' },
  { value: 'RS', label: 'Rio Grande do Sul (RS)' },
  { value: 'SC', label: 'Santa Catarina (SC)' },
  { value: 'SE', label: 'Sergipe (SE)' },
  { value: 'SP', label: 'São Paulo (SP)' },
  { value: 'TO', label: 'Tocantins (TO)' },
];
