const {run}=require('./workshop-page-check');
run('/workshops/tinkercad-ep2-popit.html',{next:'tinkercad-ep3-blocks.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
