// src/app/admin/components/TableHeader.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TableHeader, { ColumnConfig, SortConfig } from './TableHeader'; // Ajuste o caminho
import '@testing-library/jest-dom';

describe('TableHeader Component', () => {
  const mockColumns: ColumnConfig[] = [
    { key: 'name', label: 'Nome', sortable: true },
    { key: 'email', label: 'Email', sortable: false },
    { key: 'date', label: 'Data', sortable: true },
  ];
  const mockSortConfig: SortConfig = { sortBy: 'name', sortOrder: 'asc' };
  const mockOnSort = jest.fn();

  beforeEach(() => {
    mockOnSort.mockClear();
  });

  it('should render column labels correctly', () => {
    render(<TableHeader columns={mockColumns} sortConfig={mockSortConfig} onSort={mockOnSort} />);
    expect(screen.getByText('Nome')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('should call onSort when a sortable column header is clicked', () => {
    render(<TableHeader columns={mockColumns} sortConfig={mockSortConfig} onSort={mockOnSort} />);
    const nameHeader = screen.getByText('Nome').closest('th');
    if (nameHeader) fireEvent.click(nameHeader);
    expect(mockOnSort).toHaveBeenCalledWith('name');
  });

  it('should not call onSort when a non-sortable column header is clicked', () => {
    render(<TableHeader columns={mockColumns} sortConfig={mockSortConfig} onSort={mockOnSort} />);
    const emailHeader = screen.getByText('Email').closest('th');
    if (emailHeader) fireEvent.click(emailHeader);
    expect(mockOnSort).not.toHaveBeenCalled();
  });

  it('should display sort icons for sortable columns', () => {
    // Teste para verificar a presença de ícones (pode ser mais específico sobre qual ícone)
    const { container } = render(<TableHeader columns={mockColumns} sortConfig={mockSortConfig} onSort={mockOnSort} />);
    const nameHeader = screen.getByText('Nome').closest('th');
    // Exemplo: verificar se um SVG (ícone) está presente no cabeçalho 'Nome'
    // Esta verificação pode precisar ser mais robusta dependendo de como os ícones são renderizados
    expect(nameHeader?.querySelector('svg')).toBeInTheDocument();
  });

  // Adicionar mais testes para diferentes estados de sortConfig e ícones
});
