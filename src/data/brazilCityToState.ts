// Este arquivo mapeia nomes de cidades (em minúsculas e sem acentos) para a sigla do seu estado.
// É essencial que este mapa seja expandido para cobrir as principais cidades que aparecem nos seus dados.
// A chave é o nome da cidade normalizado e o valor é a sigla do estado.

export const BRAZIL_CITY_TO_STATE_MAP: Record<string, string> = {
    'sao paulo': 'SP',
    'rio de janeiro': 'RJ',
    'belo horizonte': 'MG',
    'salvador': 'BA',
    'fortaleza': 'CE',
    'recife': 'PE',
    'porto alegre': 'RS',
    'curitiba': 'PR',
    'brasilia': 'DF',
    'manaus': 'AM',
    'belem': 'PA',
    'goiania': 'GO',
    'guarulhos': 'SP',
    'campinas': 'SP',
    'sao luis': 'MA',
    'sao goncalo': 'RJ',
    'maceio': 'AL',
    'duque de caxias': 'RJ',
    'natal': 'RN',
    'campo grande': 'MS',
    // Adicione mais cidades conforme necessário...
  };
  
  /**
   * Normaliza o nome de uma cidade para busca (minúsculas, sem acentos).
   * @param cityName O nome da cidade.
   * @returns O nome da cidade normalizado.
   */
  export function normalizeCityName(cityName: string): string {
    return cityName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  