import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import JourneyMediaKit from './JourneyMediaKit';
import { track } from '@/lib/track';
jest.mock('./JourneyWorkspace', () => ({Carousel: ({title,children}: any) => <section><h2>{title}</h2>{children}</section>, readJson: jest.fn()}));
jest.mock('next/dynamic', () => () => function ProposalForm({mediaKitSlug}: any) { return <form aria-label={`Proposta para ${mediaKitSlug}`} />; });
jest.mock('next/navigation', () => ({useSearchParams: () => null, usePathname: () => '/mediakit/criadora'}));
jest.mock('@/lib/track', () => ({track: jest.fn()}));
const data = {user:{_id:'u1',name:'Criadora visitada',biography:'Histórias de viagens',email:'contato@example.com',affiliateCode:'ABC'},videos:[],summary:null,kpis:null,demographics:null};
beforeEach(() => jest.clearAllMocks());
it('mostra o criador selecionado sem ferramentas privadas nem e-mail da conta', () => {
  render(<JourneyMediaKit inline slug="criadora" initialData={data} />);
  expect(screen.getByText('Criadora visitada')).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'Histórias de viagens'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Editar'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Ver como a marca'})).not.toBeInTheDocument();
  expect(document.body.innerHTML).not.toContain('contato@example.com');
  expect(screen.getByRole('link',{name:/Crie o seu/})).toHaveAttribute('href',expect.stringContaining('aff=ABC'));
});
it('marca envia proposta pelo formulário e a visita entra no funil', () => {
  render(<JourneyMediaKit inline slug="criadora" initialData={data} />);
  expect(track).toHaveBeenCalledWith('media_kit_viewed', expect.objectContaining({creator_id:'u1',media_kit_id:'criadora'}));
  fireEvent.click(screen.getByRole('button',{name:'Enviar proposta'}));
  expect(screen.getByRole('form',{name:'Proposta para criadora'})).toBeInTheDocument();
});
it('não inventa narrativa quando ela não foi disponibilizada', () => {
  render(<JourneyMediaKit inline slug="criadora" initialData={{...data,user:{name:'Criadora'}}} />);
  expect(screen.getByText('Conheça meu trabalho nos conteúdos abaixo.')).toBeInTheDocument();
  expect(track).not.toHaveBeenCalled();
});
