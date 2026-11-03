const {run}=require('./workshop-page-check');
run('/workshops/learning-lab.html',{next:'learn.html',challenge:false,info:true}).catch(e=>{console.error(e);process.exit(1);});
