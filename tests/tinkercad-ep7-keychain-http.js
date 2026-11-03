const {run}=require('./workshop-page-check');
run('/workshops/tinkercad-ep7-keychain.html',{next:'tinkercad-ep8-shapes.html',challenge:false,reflect:true}).catch(e=>{console.error(e);process.exit(1);});
