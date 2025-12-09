const express = require('express')
require('dotenv').config()
console.log('CLIENT_URL from env =>', process.env.CLIENT_URL)
var jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express()
const cors = require('cors')
const port = process.env.PORT || 3000
app.use(express.json())
app.use(cors({
  origin:process.env.CLIENT_URL,
  credentials:true

}))
app.use(cookieParser())
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@winfinity.l0jmfpy.mongodb.net/?appName=WINFINITY`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const winfinityDB = client.db("WinfinityDB");
const userColl = winfinityDB.collection("Alluser");

const veryfyjwt=(req,res,next)=>{
  const token= req.cookies?.token;
  if(!token){
    return res.status(401).send({ message: "unauthorized" });


  }

  jwt.verify(token,process.env.JWT_KEY,(err,decoded)=>{
    if(err){
      return res.status(403).send({ message: "forbidden" });
    }
    req.decoded=decoded
    console.log(decoded)
    next();
  })
 
  
  
}

const verifyadmin=async(req,res,next)=>{
  const email= req.decoded.email
  const user= await userColl.findOne({email})
  if(!user || user.role !== `admin`){
    return res.status(403).send({ message: "forbidden access" });
  }
  next();

}
const verifycreator=async(req,res,next)=>{
  const email= req.decoded.email
  const user= await userColl.findOne({email})
  if(!user || user.role !== `creator`){
    return res.status(403).send({ message: "forbidden access" });
  }
  next();

}


async function run() {
     
      try {
    
    await client.connect();
    
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    
    app.post(`/jwt`,(req,res)=>{
      const logeduser= req.body
      const token=jwt.sign(logeduser, process.env.JWT_KEY,{expiresIn:`7d`})
      res.cookie(`token`,token,{
        httpOnly:true,
        secure:false,
        sameSite:"lax"


      }).send({success:true})

    }),
     app.post('/logout',(req,res)=>{
      res.clearCookie(`token`,{
        httpOnly:true,
        secure:false,
        sameSite:"lax"

      }).send({success:true})
     })
    app.post(`/userdata`,async(req , res)=>{
      const userdata= req.body

      const filter={email:userdata.email}
      const newuserdata={
        name:userdata.name,
        email:userdata.email,
        photoURL: userdata.photoURL,
        role:`user`,
        wins: 0,
        participatedCount: 0,
        totalPrizeWon: 0,
        bio: "",
        address: "",
        createdAt: new Date()
      }

      const updatedoc={
        $setOnInsert:newuserdata
      }
      const option={upsert: true}
      const result= await userColl.updateOne(filter,updatedoc,option)
      res.send(result)
      
    })

    app.get('/user/me',veryfyjwt, async(req,res)=>{
      const email=req.decoded.email
      const result= await userColl.findOne({email})
      res.send(result)

    })
    app.get('/alluser',veryfyjwt,verifyadmin, async(req,res)=>{
      const result= await userColl.find().toArray()
      res.send(result)
    })

    app.patch('/user/admin/:id',veryfyjwt,verifyadmin,async(req,res)=>{

      try{
         const ID=req.params.id
      const filter={_id: new ObjectId(ID)}
      const updateddoc={
        $set:{role:`admin`}
        
      }

      const result= await userColl.updateOne(filter,updateddoc)
      res.send({
        success:true,
        message:`Promoted to Admin`,
        result
      })

      }ca
     
     
    })


  } finally {}
    
}
run().catch(console.dir)



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`) 
})
