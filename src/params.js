// clearance hole and socket head diameter for each metric bolt, in mm
export const BOLTS={M2:[2.4,3.8],'M2.5':[2.9,4.5],M3:[3.4,5.5],M4:[4.5,7],M5:[5.5,8.5],M6:[6.6,10],M8:[9,13]};
export const boltDia=P=>P.boltSize==='custom'||!BOLTS[P.boltSize]?P.boltD:BOLTS[P.boltSize][0];
export const boltHead=P=>P.boltSize==='custom'||!BOLTS[P.boltSize]?P.boltD*1.6:BOLTS[P.boltSize][1];
export const PARAMS=[
 ['Panel',true,[
  {k:'W',l:'Panel width (mm)',d:400},
  {k:'H',l:'Panel height (mm)',d:200},
  {k:'B',l:'Border (mm)',d:15,h:'Fixed width. Port adaptors and bolts sit here.'},
 ]],
 ['Build',true,[
  {k:'orient',l:'Nest orientation',d:'flat',opts:[['flat','Flat (table)'],['upright','Upright (shelf)']],h:'Flat: viewed from the top. Upright: viewed from both faces. Doors and fill holes go on the top sheet (flat) or back sheet (upright).'},
  {k:'doorType',l:'Door type',d:'slide',opts:[['slide','A: sliding door'],['none','None (open tunnels)']]},
  {k:'fastener',l:'Hold together with',d:'peg',opts:[['peg','Acrylic pegs and keys'],['bolt','Bolts'],['cement','Cement only']]},
  {k:'boltSize',l:'Bolt size',d:'M3',opts:[...Object.keys(BOLTS).map(k=>[k,k]),['custom','Custom hole']],h:'Only used with bolts. Sets a clearance hole for that size.'},
  {k:'coverType',l:'Red cover',d:'whole',opts:[['whole','Whole panel'],['none','None']]},
  {k:'joinSlots',l:'Slots for joining panels',d:true,bool:true,h:'Cut on a fixed grid, so any two panels line up.'},
  {k:'joinerQty',l:'Panel joiners to cut',d:0,step:1,h:'Extra clips for joining two panels. They are added to the parts sheets, not the preview. Each one uses 2 keys.'},
 ]],
 ['Ants',true,[
  {k:'sizeFor',l:'Size for',d:'both',opts:[['workers','Workers'],['queens','Queens'],['both','Both']],h:'Chambers follow worker length (queen length if Queens). Tunnels follow queen width when given.'},
  {k:'workerLen',l:'Worker length (mm)',d:13},
  {k:'queenLen',l:'Queen length (mm)',d:null,opt:true},
  {k:'queenWidth',l:'Queen width incl. legs (mm)',d:null,opt:true},
  {k:'pitchFactor',l:'Chamber size factor',d:3,step:0.1,h:'Cell pitch = factor x ant length. The grid then stretches to fill the panel exactly.'},
  {k:'tunnelW',l:'Tunnel width override (mm)',d:null,opt:true,h:'Blank = auto from ant size.'},
 ]],
 ['Construction',false,[
  {k:'t',l:'Wall sheet thickness, measured (mm)',d:3,step:0.01,h:'Strips and frame layers are cut from this sheet.'},
  {k:'layers',l:'Frame layers',d:4,step:1,h:'Depth = layers x wall sheet thickness.'},
  {k:'S',l:'Front/back sheet thickness (mm)',d:3,step:0.01,h:'Tabs are this tall so they sit flush.'},
  {k:'tunnelH',l:'Tunnel height override (mm)',d:null,opt:true,h:'Blank = depth minus 3.'},
  {k:'tabL',l:'Tab length (mm)',d:8},
  {k:'tabPitch',l:'Tab spacing (mm)',d:35},
  {k:'kerf',l:'Kerf (mm)',d:0.15,step:0.01,h:'Measure from a test cut.'},
  {k:'slotClear',l:'Slot clearance (mm)',d:0,step:0.01,h:'Added to slot size. Negative = tighter fit.'},
  {k:'doorFit',l:'Door fit per side (mm)',d:0.1,step:0.01,h:'Gap each side of a door. Tune with the test piece.'},
  {k:'doorGrip',l:'Door head height (mm)',d:4,step:0.5},
  {k:'lipH',l:'Sand lip height, upright (mm)',d:4,step:0.5,h:'Small lips each side of floor tunnels. 0 = none.'},
  {k:'pegW',l:'Peg width (mm)',d:7,step:0.5},
  {k:'coverStand',l:'Cover gap (mm)',d:null,opt:true,h:'Blank = clears open doors.'},
 ]],
 ['Ports and bolts',false,[
  {k:'portPitch',l:'Port spacing (mm)',d:100},
  {k:'portOffset',l:'Port offset from corner (mm)',d:50},
  {k:'boltD',l:'Custom bolt hole diameter (mm)',d:3.4,step:0.1,h:'Only used when Bolt size is Custom hole.'},
  {k:'boltSpacing',l:'Max peg or bolt spacing (mm)',d:60},
 ]],
 ['Sponges and vents',false,[
  {k:'spongeD',l:'Sponge pocket width (mm)',d:6},
  {k:'spongeLen',l:'Sponge pocket length (mm)',d:24},
  {k:'slotW',l:'Sponge vent slot width (mm)',d:1.2,step:0.1,h:'Narrower than the smallest ant head.'},
  {k:'fillD',l:'Fill hole diameter (mm)',d:3,step:0.1},
  {k:'fillSide',l:'Syringe top-up from',d:'service',opts:[['service','Service side'],['front','Front'],['back','Back'],['both','Both']]},
  {k:'ventD',l:'Air vent hole diameter (mm)',d:1,step:0.1},
  {k:'ventGrid',l:'Air vents per chamber (n x n)',d:3,step:1},
 ]],
 ['Frosting',false,[
  {k:'floorFinish',l:'Floor or back sheet',d:'clear',opts:[['clear','Clear'],['frosted','Frosted'],['chosen','Chosen cells']],h:'Helps glue and sand stick. Chosen cells uses the Frost tool.'},
  {k:'ceilingFinish',l:'Top or front sheet',d:'clear',opts:[['clear','Clear'],['frosted','Frosted'],['chosen','Chosen cells']],h:'This blurs the view into the nest.'},
  {k:'wallFinish',l:'Wall strips',d:'clear',opts:[['clear','Clear'],['one','One side'],['both','Both sides']],h:'Both sides needs the sheet flipped once before cutting, and takes much longer.'},
 ]],
 ['Heat channel',false,[
  {k:'heatTop',l:'Heat top border',d:false,bool:true,h:'Border heat works on flat and upright nests. It needs a wider border. Always run heat cable from a thermostat: acrylic softens with heat.'},
  {k:'heatRight',l:'Heat right border',d:false,bool:true},
  {k:'heatBottom',l:'Heat bottom border',d:false,bool:true},
  {k:'heatLeft',l:'Heat left border',d:false,bool:true},
  {k:'heatEdgeW',l:'Border groove width (mm)',d:4,step:0.5},
  {k:'heatEdgeLayers',l:'Border groove layers',d:1,step:1,h:'Groove depth = layers x wall sheet thickness. Ports lose this much height.'},
  {k:'heatChannel',l:'Add a floor channel',d:false,bool:true,h:'Flat nests only. Adds layers under the floor sheet, hidden from view.'},
  {k:'heatW',l:'Floor channel width (mm)',d:6,step:0.5,h:'Wider than your cable.'},
  {k:'heatLayers',l:'Floor channel layers',d:2,step:1,h:'Channel depth = layers x wall sheet thickness.'},
  {k:'heatPitch',l:'Floor channel spacing (mm)',d:40},
 ]],
 ['Water',false,[
  {k:'vialD',l:'Water vial diameter (mm)',d:24,step:0.5,h:'Flat nests: use the Water tool on a sponge wall. A vial holder stands over its fill hole.'},
  {k:'vialRings',l:'Vial holder rings',d:3,step:1},
 ]],
 ['Sensors and pillars',false,[
  {k:'sensorW',l:'Sensor pocket width (mm)',d:16,step:0.5,h:'Fits a DHT22 (about 15 x 25 x 8mm). Use smaller for an SHT40 board.'},
  {k:'sensorH',l:'Sensor pocket length (mm)',d:26,step:0.5},
  {k:'broodPillar',l:'Pillar in each brood chamber',d:false,bool:true,h:'A short post that stops the sheets bowing. Add others with the Pillar tool.'},
 ]],
 ['Auto layout',true,[
  {k:'seed',l:'Seed',d:1234,step:1},
  {k:'brood',l:'Brood chambers (2x2)',d:1,step:1},
  {k:'oddShare',l:'Odd-shaped chambers (0 to 1)',d:0,step:0.05,h:'Share of cells joined into odd shapes like 1x2, L and T.'},
  {k:'oddMax',l:'Largest odd chamber (cells)',d:4,step:1},
  {k:'activeCount',l:'Chambers open at the start (0 = all)',d:0,step:1,h:'Everything is cut either way. The rest start behind closed doors. Must be above 0 for the setting below to do anything.'},
  {k:'growFrom',l:'Starting area grows from',d:'left',opts:[['left','Left'],['right','Right'],['top','Top'],['bottom','Bottom'],['center','Centre']]},
  {k:'tunnelStyle',l:'Tunnel layout',d:'branch',opts:[['branch','Branch out from the brood'],['maze','Random maze']],h:'Branching gives every chamber the shortest way back to the brood chamber. A maze is longer and more winding.'},
  {k:'loops',l:'Extra loop tunnels (0 to 1)',d:0.1,step:0.05,h:'Each one adds a door and a second way round.'},
  {k:'sponges',l:'Sponges',d:3,step:1},
  {k:'dampSide',l:'Damp side',d:'random',opts:[['random','Random side'],['left','Left'],['right','Right'],['top','Top'],['bottom','Bottom'],['none','None (spread)']],h:'Sponges favour one side, so the ants get a damp end and a dry end. They are kept apart where there is room.'},
 ]],
 ['Angled shapes (need glue)',false,[
  {k:'angled',l:'Use angled shapes',d:false,bool:true,h:'Off keeps the nest a pure jigsaw. On adds diagonal walls and jogs, whose joints must be sealed with acrylic cement and sand.'},
  {k:'diagShare',l:'Diagonal cells (0 to 1)',d:0.15,step:0.05},
  {k:'jogShare',l:'Jogged walls (0 to 1)',d:0.6,step:0.05,h:'Share of solid walls. Walls with tunnels or sponges stay straight.'},
  {k:'chamfer',l:'Chamfer sharp corners (mm)',d:0,step:1,h:'0 = none. Cuts off the tight corners of diagonals. Try 14.'},
  {k:'jogSize',l:'Jog size (mm)',d:8,step:0.5,h:'Under 8mm the angled strip has no room for a tab. Under 6mm there are no jogs.'},
 ]],
 ['Export',false,[
  {k:'bed',l:'Laser bed check',d:'none',opts:[['none','None'],['speedy300','Trotec Speedy 300'],['speedy360','Trotec Speedy 360']]},
  {k:'exportDxf',l:'Also export DXF',d:false,bool:true,h:'Adds a DXF of each cut file. Engraving stays in the SVG.'},
  {k:'stockW',l:'Wall sheet stock width (mm)',d:600},
  {k:'stockH',l:'Wall sheet stock height (mm)',d:400},
  {k:'cutColor',l:'Cut line colour',d:'#ff0000',color:true},
  {k:'engraveColor',l:'Engrave colour',d:'#000000',color:true},
  {k:'engraveIds',l:'Engrave part IDs',d:true,bool:true},
 ]],
];
export const GEN_KEYS=new Set(['chamfer','broodPillar','seed','brood','oddShare','oddMax','angled','diagShare','jogShare','jogSize','activeCount','growFrom','tunnelStyle','loops','sponges','dampSide']);
export // sane limits, which also stop a bad value from freezing the page
const RANGES={W:[60,3000],H:[60,3000],B:[5,100],workerLen:[1,100],queenLen:[1,100],queenWidth:[1,100],pitchFactor:[1,10],tunnelW:[1,100],
  t:[0.5,20],layers:[1,20],S:[0.5,20],tunnelH:[1,200],tabL:[2,100],tabPitch:[5,500],kerf:[0,2],slotClear:[-2,2],doorFit:[0,2],doorGrip:[3,30],
  lipH:[0,30],pegW:[4,30],coverStand:[1,100],portPitch:[0,2000],portOffset:[0,2000],boltD:[1,30],boltSpacing:[10,1000],spongeD:[1,100],
  spongeLen:[1,500],slotW:[0.1,20],fillD:[0.5,50],ventD:[0.1,20],ventGrid:[0,8],seed:[0,1e9],brood:[0,30],oddShare:[0,1],oddMax:[2,12],
  activeCount:[0,1000],loops:[0,1],sponges:[0,200],stockW:[50,3000],stockH:[50,3000],diagShare:[0,1],jogShare:[0,1],jogSize:[0,50],joinerQty:[0,50],sensorW:[5,80],sensorH:[5,80],heatW:[3,30],heatLayers:[1,10],heatPitch:[15,300],heatEdgeW:[2,15],heatEdgeLayers:[1,6],vialD:[8,80],vialRings:[1,10],chamfer:[0,40]};
for(const g of PARAMS)for(const f of g[2])if(RANGES[f.k])f.range=RANGES[f.k];
export const ALL_FIELDS=PARAMS.flatMap(g=>g[2]);
