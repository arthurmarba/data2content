import { loadDashboardOpportunities } from "./dashboardCatalog";
import { listDashboardCampaignRadarCatalog } from "./repository";
jest.mock("./repository",()=>({listDashboardCampaignRadarCatalog:jest.fn()}));
it("não apresenta orçamento total como cachê individual nem expõe revisão interna",async()=>{
  (listDashboardCampaignRadarCatalog as jest.Mock).mockResolvedValue([{id:"1",title:"Campanha",sourcePlatform:"Fonte",sourceUrl:"https://example.com",territories:[],formats:[],requirements:[],deliverables:[],compensation:{type:"fixed",minimum:100000,maximum:100000,basis:"total_campaign_budget",confirmed:true,sourceText:"R$ 100 mil"},review:{notes:"privado"}}]);
  const [item]=await loadDashboardOpportunities();
  expect(item?.minimum).toBeNull();expect(item?.payment).toBe("unknown");expect(item).not.toHaveProperty("review");
  // Chamada sem provas, redes ou data de entrada não pode derrubar o catálogo.
  expect(item?.evidence).toEqual([]);expect(item?.platforms).toEqual([]);expect(item?.discoveredAt).toBeNull();
  expect(listDashboardCampaignRadarCatalog).toHaveBeenCalledWith();
});

it("mantém o catálogo completo e diferencia encerradas das que precisam de confirmação", async () => {
  const base = {id:"1",title:"Campanha",sourcePlatform:"Fonte",sourceUrl:"https://example.com",territories:[],formats:[],requirements:[],deliverables:[],compensation:{type:"unknown"},status:"open",lastVerifiedAt:new Date().toISOString()};
  (listDashboardCampaignRadarCatalog as jest.Mock).mockResolvedValue([
    {...base,id:"encerrada",applicationDeadline:"2000-01-01"},
    {...base,id:"sem-prazo",applicationDeadline:null},
    {...base,id:"aberta",applicationDeadline:"2099-01-01"},
  ]);
  const items = await loadDashboardOpportunities();
  expect(items.map(item => item.availability)).toEqual(["closed","recheck","open"]);
});
