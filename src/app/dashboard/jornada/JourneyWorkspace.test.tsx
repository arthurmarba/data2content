import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import JourneyWorkspace from "./JourneyWorkspace";
import type { DiagnosticoPageData } from "../boards/videoUpload/diagnosticoPageData";
jest.mock("next/dynamic", () => () => () => null);
const profile = {userInfo:{plan:"Pro"}, accessState:"admin"} as DiagnosticoPageData;
const baseProps={data:profile,profile:<p>Meu perfil</p>,onOpenMediaKit:jest.fn(),onOpenCalculator:jest.fn(),onUpgrade:jest.fn(),onOpenCreatorMediaKit:jest.fn()};
beforeEach(()=>{window.history.replaceState(null,"","/dashboard/jornada");jest.clearAllMocks();});
it("abre as ferramentas pelas ações reais e mantém a ordenação dentro dos filtros",async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({opportunities:[]})});
 render(<JourneyWorkspace {...baseProps}/>);
 fireEvent.click(screen.getByRole("button",{name:"Publis",exact:true}));
 fireEvent.click(screen.getByRole("button",{name:/Apresente seu trabalho/}));
 expect(baseProps.onOpenMediaKit).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole("button",{name:/Prepare seu orçamento/}));
 expect(baseProps.onOpenCalculator).toHaveBeenCalledTimes(1);
 expect(screen.queryByLabelText("Exibir primeiro")).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Filtros",exact:true}));
 expect(screen.getByLabelText("Exibir primeiro")).toBeInTheDocument();
 expect(await screen.findByText("Nenhuma oportunidade revisada e aberta no momento.")).toBeInTheDocument();
});
const publi=(over:Record<string,unknown>)=>({id:"o1",locked:false,availability:"open",title:"Campanha de verão",brand:"Marca A",summary:"resumo da chamada",source:"Influencer Brasil",sourceId:"influencer-brasil",url:"https://exemplo.com/inscricao",applicationLabel:"Inscrever-se",requiresAccount:true,territories:[],formats:["Reel"],platforms:["Instagram"],requirements:["Mínimo de 1.000 seguidores"],deliverables:["1 vídeo"],evidence:[{field:"compensation",excerpt:"pagamos R$ 900 por vídeo"}],deadline:"2026-09-30",verifiedAt:"2026-09-15",discoveredAt:"2020-01-01",publishedAt:null,includesProduct:false,payment:"paid",minimum:900,compensation:"R$ 900",...over});
// jsdom não implementa dialog: sem marcar `open`, o conteúdo existe mas conta
// como escondido e nenhuma busca por papel (link, título) o encontra.
beforeAll(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 HTMLDialogElement.prototype.close=function(){this.open=false;};
});
it("abre o detalhe da publi ao tocar no cartão, com os fatos e a inscrição na fonte",async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({opportunities:[publi({})]})});
 render(<JourneyWorkspace {...baseProps}/>);
 fireEvent.click(screen.getByRole("button",{name:"Publis",exact:true}));
 fireEvent.click(await screen.findByRole("button",{name:/Campanha de verão/}));
 const detalhe=within(screen.getByRole("dialog"));
 expect(detalhe.getByRole("heading",{name:"Campanha de verão"})).toBeInTheDocument();
 expect(detalhe.getByText("Cachê individual confirmado na chamada")).toBeInTheDocument();
 expect(detalhe.getByText("1 vídeo")).toBeInTheDocument();
 expect(detalhe.getByText("A inscrição exige conta na plataforma")).toBeInTheDocument();
 expect(detalhe.getByText("Mínimo de 1.000 seguidores")).toBeInTheDocument();
 expect(detalhe.getByText("pagamos R$ 900 por vídeo")).toBeInTheDocument();
 expect(detalhe.getByRole("link",{name:/Inscrever-se/})).toHaveAttribute("href","https://exemplo.com/inscricao");
 expect(detalhe.getByText(/A inscrição acontece no site da Influencer Brasil/)).toBeInTheDocument();
});
it("marca como novidade só o que o radar achou nos últimos dias",async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({opportunities:[publi({}),publi({id:"o2",title:"Chegou agora",discoveredAt:new Date().toISOString()})]})});
 render(<JourneyWorkspace {...baseProps}/>);
 fireEvent.click(screen.getByRole("button",{name:"Publis",exact:true}));
 expect(await screen.findAllByText("Novo")).toHaveLength(1);
});
it("na trancada, o detalhe cobra assinatura e não entrega link nem briefing",async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({opportunities:[publi({}),publi({id:"o2",locked:true,title:"Credenciamento",url:"",applicationLabel:"",summary:"",requirements:[],deliverables:[],evidence:[]})]})});
 render(<JourneyWorkspace {...baseProps} data={{userInfo:{plan:"Free"},accessState:"free_unused"} as DiagnosticoPageData}/>);
 fireEvent.click(screen.getByRole("button",{name:"Publis",exact:true}));
 fireEvent.click(await screen.findByRole("button",{name:/Credenciamento/}));
 const detalhe=within(screen.getByRole("dialog"));
 expect(detalhe.getByRole("heading",{name:"O briefing fica no Pro"})).toBeInTheDocument();
 expect(detalhe.queryByRole("link")).not.toBeInTheDocument();
 fireEvent.click(detalhe.getByRole("button",{name:"Ver com o Pro"}));
 expect(baseProps.onUpgrade).toHaveBeenCalledWith("publis");
 fireEvent.click(detalhe.getByRole("button",{name:"← Voltar"}));
 fireEvent.click(screen.getByRole("button",{name:"Assinar para ver todas"}));
 expect(screen.getByRole("heading",{name:"Mais 1 publi aberta agora"})).toBeInTheDocument();
});
it("filtra por cachê e permuta direto nas pílulas",async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({opportunities:[publi({}),publi({id:"o2",title:"Troca de produto",payment:"barter",minimum:null,compensation:"Permuta"})]})});
 render(<JourneyWorkspace {...baseProps}/>);
 fireEvent.click(screen.getByRole("button",{name:"Publis",exact:true}));
 expect(await screen.findByRole("button",{name:/Troca de produto/})).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Com cachê"}));
 expect(screen.queryByRole("button",{name:/Troca de produto/})).not.toBeInTheDocument();
 expect(screen.getByRole("button",{name:/Campanha de verão/})).toBeInTheDocument();
});
it("pede assinatura na comunidade e nas gravações dizendo o assunto",async()=>{
 global.fetch=jest.fn().mockImplementation(async(url:string)=>({ok:true,json:async()=>url.includes("recorded-meetings")?{meetings:[{id:"r1",title:"Narrativa e conteúdo",publishedAt:"2026-09-10"}]}:{creators:[]}}));
 render(<JourneyWorkspace {...baseProps} data={{userInfo:{plan:"Free"},accessState:"free_unused"} as DiagnosticoPageData}/>);
 fireEvent.click(screen.getByRole("button",{name:"Comunidade",exact:true}));
 expect(screen.queryByRole("link",{name:/Abrir grupo/})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Entrar na comunidade"}));
 expect(baseProps.onUpgrade).toHaveBeenCalledWith("community");
 fireEvent.click(await screen.findByRole("button",{name:/Narrativa e conteúdo/}));
 expect(baseProps.onUpgrade).toHaveBeenCalledWith("recorded_meetings");
});
it("guarda os pedidos do Claude num card que abre a gaveta",async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({opportunities:[]})});
 render(<JourneyWorkspace {...baseProps}/>);
 // No Perfil não sobra carrossel de pedido: só o card.
 expect(screen.queryByRole("heading",{name:"Ter ideias do que postar"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:/pedidos prontos/}));
 const gaveta=within(screen.getByRole("dialog"));
 expect(gaveta.getByRole("heading",{name:/Seu perfil dentro do Claude/})).toBeInTheDocument();
 expect(gaveta.getByText("Como conectar · 4 passos")).toBeInTheDocument();
 expect(gaveta.getByRole("heading",{name:"Ter ideias do que postar"})).toBeInTheDocument();
 expect(gaveta.getByText("Estou sem ideia. O que eu posso postar esta semana?")).toBeInTheDocument();
 // Grupos do fim viram lista, não carrossel — e o nome também é atalho no topo.
 expect(gaveta.getByRole("heading",{name:/Encontrar oportunidades de trabalho/})).toBeInTheDocument();
 expect(gaveta.getByRole("link",{name:"Encontrar oportunidades de trabalho"})).toBeInTheDocument();
 expect(gaveta.getAllByRole("button",{name:"Copiar pedido"}).length).toBeGreaterThan(5);
});
it("exibe gravações e pesquisa criadores reais sem esconder a comunidade",async()=>{
 global.fetch=jest.fn().mockImplementation(async(url:string)=>({ok:true,json:async()=>url.includes("recorded-meetings")?{meetings:[{id:"r1",title:"Narrativa e conteúdo",publishedAt:"2026-09-10",thumbnailUrl:"/api/dashboard/recorded-meetings/r1/thumbnail"}]}:{creators:[{id:"c1",name:"Lívia",username:"livia",mediaKitSlug:"livia",niches:["Humor"]},{id:"c2",name:"Ana",username:"ana",niches:["Moda"]}]}}));
 render(<JourneyWorkspace {...baseProps}/>);
 fireEvent.click(screen.getByRole("button",{name:"Comunidade",exact:true}));
 expect(screen.getByRole("link",{name:/Abrir grupo/})).toHaveAttribute("href","/api/dashboard/community/pro-join");
 // Descoberta primeiro: os criadores vêm antes do card da comunidade.
 const secoes=[...document.querySelectorAll(".j-content > section")];
 expect(secoes.findIndex(s=>s.querySelector(".j-search"))).toBeLessThan(secoes.findIndex(s=>s.classList.contains("j-community-meeting")));
 expect(await screen.findByRole("heading",{name:"Narrativa e conteúdo"})).toBeInTheDocument();
 await screen.findByRole("heading",{name:"Lívia"});
 fireEvent.change(screen.getByRole("textbox",{name:"Buscar criadores"}),{target:{value:"Lívia"}});
 expect(screen.queryByRole("heading",{name:"Ana"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Conhecer perfil ↗"}));
 expect(baseProps.onOpenCreatorMediaKit).toHaveBeenCalledWith("livia");
});
