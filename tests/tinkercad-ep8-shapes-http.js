const {run}=require('./workshop-page-check');
run('/workshops/tinkercad-ep8-shapes.html',{next:'engine-tinkercad.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
