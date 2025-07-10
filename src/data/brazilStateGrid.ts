export interface BrazilStateTile {
  id: string;
  name: string;
  row: number;
  col: number;
}

// Simplified tile grid layout of Brazil states for heatmap visualization
// Coordinates roughly represent geographic position but are not to scale
export const BRAZIL_STATE_GRID: BrazilStateTile[] = [
  { id: 'RR', name: 'Roraima', row: 0, col: 4 },
  { id: 'AP', name: 'Amap\u00E1', row: 1, col: 5 },
  { id: 'AM', name: 'Amazonas', row: 2, col: 3 },
  { id: 'PA', name: 'Par\u00E1', row: 2, col: 5 },
  { id: 'AC', name: 'Acre', row: 3, col: 2 },
  { id: 'RO', name: 'Rond\u00F4nia', row: 3, col: 3 },
  { id: 'MT', name: 'Mato Grosso', row: 3, col: 4 },
  { id: 'TO', name: 'Tocantins', row: 3, col: 5 },
  { id: 'MA', name: 'Maranh\u00E3o', row: 3, col: 6 },
  { id: 'PI', name: 'Piau\u00ED', row: 4, col: 6 },
  { id: 'CE', name: 'Cear\u00E1', row: 4, col: 7 },
  { id: 'RN', name: 'Rio Grande do Norte', row: 4, col: 8 },
  { id: 'PB', name: 'Para\u00EDba', row: 5, col: 8 },
  { id: 'PE', name: 'Pernambuco', row: 5, col: 7 },
  { id: 'AL', name: 'Alagoas', row: 6, col: 8 },
  { id: 'SE', name: 'Sergipe', row: 6, col: 7 },
  { id: 'BA', name: 'Bahia', row: 6, col: 6 },
  { id: 'DF', name: 'Distrito Federal', row: 5, col: 4 },
  { id: 'GO', name: 'Goi\u00E1s', row: 5, col: 3 },
  { id: 'MS', name: 'Mato Grosso do Sul', row: 4, col: 3 },
  { id: 'MG', name: 'Minas Gerais', row: 6, col: 5 },
  { id: 'ES', name: 'Esp\u00EDrito Santo', row: 7, col: 6 },
  { id: 'RJ', name: 'Rio de Janeiro', row: 8, col: 5 },
  { id: 'SP', name: 'S\u00E3o Paulo', row: 7, col: 4 },
  { id: 'PR', name: 'Paran\u00E1', row: 8, col: 4 },
  { id: 'SC', name: 'Santa Catarina', row: 9, col: 4 },
  { id: 'RS', name: 'Rio Grande do Sul', row: 10, col: 4 },
];
