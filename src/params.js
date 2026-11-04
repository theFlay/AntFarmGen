export const PARAMS=[
 ['Panel',true,[
  {k:'W',l:'Panel width (mm)',d:400},
  {k:'H',l:'Panel height (mm)',d:200},
  {k:'B',l:'Border (mm)',d:15,h:'Fixed width. Port adaptors and bolts sit here.'},
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
 ]],
 ['Ports and bolts',false,[
  {k:'portPitch',l:'Port spacing (mm)',d:100},
  {k:'portOffset',l:'Port offset from corner (mm)',d:50},
  {k:'boltD',l:'Bolt hole diameter (mm)',d:3.4,step:0.1},
  {k:'boltSpacing',l:'Max bolt spacing (mm)',d:60},
 ]],
 ['Sponges and vents',false,[
  {k:'spongeD',l:'Sponge pocket width (mm)',d:6},
  {k:'spongeLen',l:'Sponge pocket length (mm)',d:24},
  {k:'slotW',l:'Sponge vent slot width (mm)',d:1.2,step:0.1,h:'Narrower than the smallest ant head.'},
  {k:'fillD',l:'Fill hole diameter (mm)',d:3,step:0.1},
  {k:'fillSide',l:'Syringe top-up from',d:'front',opts:[['front','Front'],['back','Back'],['both','Both']]},
  {k:'ventD',l:'Air vent hole diameter (mm)',d:1,step:0.1},
  {k:'ventGrid',l:'Air vents per chamber (n x n)',d:3,step:1},
 ]],
 ['Auto layout',true,[
  {k:'seed',l:'Seed',d:1234,step:1},
  {k:'brood',l:'Brood chambers (2x2)',d:1,step:1},
  {k:'activeCount',l:'Active chambers (0 = all)',d:0,step:1,h:'Unused cells stay sealed. Start small and grow.'},
  {k:'growFrom',l:'Grow active area from',d:'left',opts:[['left','Left'],['right','Right'],['top','Top'],['bottom','Bottom'],['center','Centre']]},
  {k:'loops',l:'Extra loop tunnels (0 to 1)',d:0.15,step:0.05},
  {k:'sponges',l:'Sponges',d:3,step:1},
  {k:'dampSide',l:'Damp side',d:'left',opts:[['left','Left'],['right','Right'],['top','Top'],['bottom','Bottom'],['none','None (spread)']]},
 ]],
 ['Export',false,[
  {k:'stockW',l:'Strip stock sheet width (mm)',d:600},
  {k:'stockH',l:'Strip stock sheet height (mm)',d:400},
  {k:'cutColor',l:'Cut line colour',d:'#ff0000',color:true},
  {k:'engraveColor',l:'Engrave colour',d:'#000000',color:true},
  {k:'engraveIds',l:'Engrave part IDs',d:true,bool:true},
 ]],
];
export const GEN_KEYS=new Set(['seed','brood','activeCount','growFrom','loops','sponges','dampSide']);
export const ALL_FIELDS=PARAMS.flatMap(g=>g[2]);
