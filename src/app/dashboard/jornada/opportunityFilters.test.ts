import { filterOpportunities } from "./opportunityFilters";
import type { DashboardOpportunity } from "@/app/lib/campaignRadar/dashboardCatalog";
const base: DashboardOpportunity = { id: "1", title: "Campanha de alimentação", brand: "Marca", summary: "Rotina na cozinha", source: "Fonte A", url: "https://example.com", territories: ["Cozinha"], formats: ["Reels"], requirements: [], deliverables: [], deadline: "2026-09-18", verifiedAt: "2026-09-14", payment: "paid", minimum: 1500, compensation: "R$ 1.500" };
const items = [base,{...base,id:"2",source:"Fonte B",payment:"unknown",minimum:null,deadline:null},{...base,id:"3",minimum:2500,deadline:"2026-09-16"}];
it("combina os filtros sem depender de acentos na busca",()=>{expect(filterOpportunities(items,"alimentacao","Fonte A","Cozinha","paid","Reels","deadline").map(i=>i.id)).toEqual(["3","1"]);});
it("mantém chamadas sem prazo no fim e não altera o catálogo",()=>{expect(filterOpportunities(items,"","","","","","deadline").map(i=>i.id)).toEqual(["3","1","2"]);expect(items[0]?.id).toBe("1");});
it("ordena pelo cachê individual confirmado e mantém todas as chamadas",()=>{expect(filterOpportunities(items,"","","","","","payment").map(i=>i.id)).toEqual(["3","1","2"]);});
it("não deixa uma busca vazia reutilizar resultados incompatíveis",()=>{expect(filterOpportunities(items,"inexistente","","","","","deadline")).toEqual([]);});
