const express = require('express')
require('dotenv').config()
console.log('JWT_KEY length =>', process.env.JWT_KEY?.length);
console.log('CLIENT_URL from env =>', process.env.CLIENT_URL)
var jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const stripe = require('stripe')(`${process.env.STRIPE_KEY}`);
const app = express()
const cors = require('cors')
const port = process.env.PORT || 3000
app.use(express.json())
app.use(cors({
  origin:[
    'http://localhost:5173',
    'http://localhost:3000',
    'https://winfinityhub.netlify.app'
  ],
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
const ContestColl = winfinityDB.collection("Allcontest");
const registrationColl = winfinityDB.collection("Allregistration");
const submissioncol = winfinityDB.collection("Allsubmission");
const Winnercol = winfinityDB.collection("Allwinner");

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
  req.dbUser=user
  next();

}


async function run() {
     
      try {
    
    // await client.connect();
    //     await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
    

    
    app.post('/jwt', (req, res) => {
  try {
    const logeduser = req.body;

    
    

    if (!process.env.JWT_KEY) {
     
      return res.status(500).send({ message: 'Server misconfigured: missing JWT_KEY' });
    }

    const token = jwt.sign(logeduser, process.env.JWT_KEY, { expiresIn: '7d' });

  res.cookie("token", token, {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
}).send({ success: true });
  } catch (err) {
    console.error('Error in /jwt route:', err);
    res.status(500).send({ message: 'Failed to create token' });
  }
});
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
         const{role}=req.body
      const filter={_id: new ObjectId(ID)}
      const updateddoc={
        $set:{role:`${role}`}
        
      }

      const result= await userColl.updateOne(filter,updateddoc)
        console.log('updateOne result =>', result);

        if (!result.matchedCount) {
      return res.status(404).send({
        success: false,
        message: 'User not found for this ID',
      });
    }
      res.send({
        success:true,
        message:`Promoted to Admin`,
        result
      })

      }catch(error){
        console.error('Error promoting user:', error);
        res.status(500).send({
      success: false,
      message: 'Server error while promoting user',
    })
      }
     
     
    })

    app.post(`/creator/contest`,veryfyjwt,verifycreator,async(req,res)=>{
      try{
        const{name,
      photoo,
      description,
      price,
      prizeMoney,
      taskInstruction,
      type,
      deadline,}= req.body

       if (!name || !photoo || !description || !price || !prizeMoney || !taskInstruction || !type || !deadline) {
      return res.status(400).send({ message: 'All fields are required' });
 }

   const newcontest={
       name,
      photoo,
      description,
      price: Number(price),
      prizeMoney: Number(prizeMoney),
      taskInstruction,
      type,
      deadline: deadline,
      creatorId: req.dbUser._id,
      creatorEmail: req.dbUser.email,
      status: 'pending',
      participantsCount: 0,
      winnerUserId: null,
      winnerSubmissionId: null,
      createdAt: new Date(),
      
     }

     const result= await ContestColl.insertOne(newcontest)
     return res.send({
      success: true,
      message: 'Contest created and pending admin approval',
      insertedId: result.insertedId,
     })
      
    }catch(err){
      console.error('Error creating contest:', error);
    return res.status(500).send({ message: 'Server error while creating contest' })
    }
    
    })

    app.get('/allcontest',async(req,res)=>{
      const result= await ContestColl.find().toArray()
      res.send(result)
    })

    app.get(`/creatorcontest`,veryfyjwt,verifycreator,async(req , res)=>{
      
       const email=req.dbUser.email
        const query={creatorEmail:email}
        const result= await ContestColl.find(query).toArray()
        res.send(result)
    })
    app.patch('/contest/:id',veryfyjwt,verifyadmin,async(req,res)=>{
      const id= req.params.id
      const {status}=req.body
      const filter={ _id: new ObjectId(id)}
      const updateddoc={
        $set:{status:`${status}`}
      }
      const result= await ContestColl.updateOne(filter,updateddoc)
      res.send(result)
    })
    app.get('/contest/status/approved',async(req,res)=>{
      const filter={status:"Approved"}
      const result= await ContestColl.find(filter).toArray()
      res.send(result)
    })

    app.get('/contest/detail/:id',veryfyjwt,async(req,res)=>{
      const id= req.params.id
      const query={_id:new ObjectId(id)}
      const result= await ContestColl.find(query).toArray()
      res.send(result)
    })

    app.post('/logout',async(req,res)=>{
        res.clearCookie("token", {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
}).send({ success: true })
    })

         
     app.post('/contest-post',veryfyjwt,async(req,res)=>{
      try{
        const{contestId,amount,namu,deadline}=req.body
        const query={ _id: new ObjectId(contestId) , 
          status:"Approved"}
        const useremail= req.decoded.email

        const resultcont= await ContestColl.findOne(query)
        if(!resultcont){
           return res.status(404).send({ message: "Contest not found or not approved" })
        }
        if( new Date(resultcont.deadline)< new Date()){
          return res.status(400).send({ message: "Contest has already ended" })
        }

        const exist = await registrationColl.findOne({
          contestId: contestId,
          useremail
        })
        if(exist){
          return res.status(400).send({ message: "Already registered" })
        }

       await registrationColl.insertOne({
         contestId,
          namu,
          useremail,
          deadline,
          amount,
           paymentStatus: "paid",
           paymentedAt: new Date(),

        })

        await userColl.updateOne({ email:useremail},{

                $inc:{participatedCount: 1}
        })
        await ContestColl.updateOne(query,{
          $inc:{participantsCount:1} 
        })

        res.send(`payment done`)
      }catch(error){
         console.error("Registration error:", error);
    res.status(500).send({ message: "Server error during registration" });
      }
     })

     app.get(`/payments/status`,veryfyjwt,async(req,res)=>{
      try{
      const useremail= req.decoded.email
      const {contestid}=req.query
      if(!contestid){
        return res.status(400).send({ message: "contestId is required" })
      }

      const query={
        contestId:contestid,
        useremail,
        paymentStatus:"paid"

      }

      const payment= await registrationColl.findOne(query)
      res.send({
      hasPaid: !!payment
      
    })

      }catch(err){
        console.error("Payment status error:", err);
    res.status(500).send({ message: "Internal server error" })

      }

     })


      app.post('/submittask',veryfyjwt,async(req,res)=>{
      try{

        const useremail=req.decoded.email
      const{contestid, submissionText,name,contestname,prizemoney}=req.body
      const filter={
        useremail,
        contestid
      };

      const payload={
        useremail,
        name,
        contestid,
        contestname,
         prizemoney,
         submissionText,
        isWinner:false
      }


      const filterfind={
        _id:new ObjectId(contestid)
      }


      const update={
  $set: {
    issubmission:true

  },
}

      const exist= await submissioncol.findOne(filter)
      if(exist){
        return res.status(400).send({ message: "All ready submitted" })

      }
       await submissioncol.insertOne(payload)

       await ContestColl.updateOne(filterfind,update)



      return res.send(`submission done`)

      }catch(err){
        console.error("Payment status error:", err);
    res.status(500).send({ message: "Internal server error" })
        
      }
      

    })



    app.get(`/submitedornot`,veryfyjwt,async(req,res)=>{
      const{contestid}=req.query
      const useremail=req.decoded.email
      const filter={
        contestid,
        useremail
      }

      const exist= await submissioncol.findOne(filter)
      if(exist){
        res.send({issubmited:true})
      }else{
        res.send({issubmited:false})
      }
      
    })

     app.get('/contest/detailofupdate/:id',veryfyjwt,async(req,res)=>{
      const id= req.params.id
      const query={_id:new ObjectId(id)}
      const result= await ContestColl.findOne(query)
      res.send(result)
    }) 

    app.patch(`/contest/update/:id`,veryfyjwt,verifycreator,async(req,res)=>{
       const id= req.params.id
       const contestid= {_id: new ObjectId(id)}
       const result= await ContestColl.updateOne(contestid,{$set:req.body})
       res.send(`update done`,result)
    })

    app.delete('/contest/delete/:id',veryfyjwt,verifycreator,async(req,res)=>{
      const id= req.params.id
      const query={_id: new ObjectId(id)}
      const result= await ContestColl.deleteOne(query)
      res.send(result)

    })

    app.get(`/submission/:id`,veryfyjwt,verifycreator,async(req,res)=>{
      const id= req.params.id
      const filter={contestid:id}
      const result= await submissioncol.find(filter).toArray()
      res.send(result)

      
    })

    app.get(`/contest/name/:id`,veryfyjwt,verifycreator,async(req,res)=>{
      const id=req.params.id
      const filter={_id:new ObjectId(id)}
      const result=await ContestColl.findOne(filter,{projection:{name:1,winnerUserId:1}});
      res.send(result)
    })

    app.patch(`/winnerdeclaraqtion`,veryfyjwt,verifycreator,async(req,res)=>{
      const {id,email}=req.body
      
      
      const contestfilter={_id:new ObjectId(id)}
      const contestupdate={
        $set:{
          winnerUserId:email.email
        }
      }
     

const payload={
  contestID:id,

  winneremail:email.email,
  contestname:email.contestname,
  prizemoney:email.prizemoney
 
}

      const find=await submissioncol.updateOne({ contestid: id, useremail: email.email },
  { $set: { isWinner: true } })
      const winnerupdate= await ContestColl.updateOne(contestfilter,contestupdate)
      const userwins= await userColl.updateOne({email:email.email},{$inc:{wins:1}})
      const winninglis= await Winnercol.updateOne({ contestID: id },
  {
    $setOnInsert: {
      contestID: id,
      winneremail: email.email,
      contestname: email.contestname,
      prizemoney: email.prizemoney,
      createdAt: new Date()
    }
  },
  { upsert: true })
      res.send(`winner updated`)
    })

    app.get(`/paymentdetail-user`,veryfyjwt,async(req,res)=>{
      const email=req.decoded.email
      const query={useremail:email}
      const result=await registrationColl.find(query).toArray()
      res.send(result)
    })

   app.get(`/winning-list`,veryfyjwt,async(req,res)=>{
    const email=req.decoded.email
    const query={winneremail:email}
    const result= await Winnercol.find(query).toArray()
    res.send(result)
    
   })
   app.patch(`/editprofileinfo`,veryfyjwt,async(req,res)=>{
    const  info=req.body
    const email=req.decoded.email
    const query={email:email}
    const update={
      $set:info
    }
    const result= await userColl.updateOne(query,update)
    res.send(result)
   })

   app.get(`/winneruserid/:email`,veryfyjwt,async(req,res)=>{
    const email=req.params.email
    const query={email:email}
    if(email == null){
      return(`Winner is not selected yet`)
    }
    const result= await userColl.findOne(query,{projection:{photoURL:1}})
    res.send(result)
   })

   app.get(`/allsearch-contests`,async(req,res)=>{
    const{search}=req.query
    const query={
      status:"Approved"
    }
    if(search){
      query.type={$regex:search,$options:`i`}
    }
    const result= await ContestColl.find(query).toArray()
    res.send(result)
   })

   app.get(`/hypercontest`,async(req,res)=>{
    const result= await ContestColl.find({status:"Approved"}).sort({participantsCount:-1}).limit(5).toArray()
    res.send(result)
   })

   app.get(`/leaderbord`,async(req,res)=>{
    const result= await userColl.find().sort({wins:-1}).toArray()
    res.send(result)
   })



   app.post("/create-checkout-session",veryfyjwt,async(req,res)=>{
    const { contestId,amount,namu,deadline } = req.body;
    const useremail = req.decoded.email;
      const contest = await ContestColl.findOne({
    _id: new ObjectId(contestId),
    status: "Approved",
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: useremail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: contest.price * 100,
          product_data: { name: contest.name },
        },
        quantity: 1,
      },
    ],
    metadata: { contestId, useremail,namu,deadline },
   success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
   cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,
  });

      res.send({ url: session.url });

   })


app.post("/confirm-payment",veryfyjwt,async(req,res)=>{
  const { sessionId } = req.body;

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return res.status(400).send({ message: "Payment not completed" });
  }

  const { contestId, useremail,namu,deadline } = session.metadata;

  const exist = await registrationColl.findOne({ contestId, useremail });
  if (exist) {
    return res.send({ message: "Already registered" });


  }

  await registrationColl.insertOne({
    contestId,
    useremail,
    namu,
    deadline,
    amount: session.amount_total / 100,
    paymentStatus: "paid",
    paidAt: new Date(),
    stripeSessionId: session.id,
  });

  await userColl.updateOne(
    { email: useremail },
    { $inc: { participatedCount: 1 } }
  );

  await ContestColl.updateOne(
    { _id: new ObjectId(contestId) },
    { $inc: { participantsCount: 1 } }
  );

  res.send({ contestId })


})


  } finally {}
    
}
run().catch(console.dir)



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`) 
})
