const Redis = require('ioredis');
const redis = new Redis();
(async()=>{
  try{
    const keys = await redis.keys('sinfo_*');
    console.log('keys', keys);
    for(const k of keys){
      const v = await redis.get(k);
      console.log(k, '=>', v);
    }
  }catch(e){
    console.error('ERR', e.message);
    process.exit(2);
  }finally{
    redis.disconnect();
  }
})();
