import {Router} from 'express'
import { 
    changeCurrentPassword, 
    getCurrentUser, 
    getUserChannelProfile, 
    getWatchHistory, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    registerUser, 
    updateAccoutDetails, 
    updateUserAvatar, 
    updateUserCoverImg 
} from '../controllers/user.controller.js'
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from '../middlewares/auth.middleware.js'

const router = Router()

router.route("/register").post(upload.fields([
    {
        name:"avatar",
        maxCount: 1
    },
    {
        name:"coverImg",
        maxCount:1
    }
]),registerUser)

router.route("/login").post(loginUser)


//secured routers

router.route("/logout").post(verifyJWT,logoutUser)
router.route("/channel/:username").get(verifyJWT,getUserChannelProfile)
router.route("/refresh-token").post(refreshAccessToken)

router.route("/change-password").post(verifyJWT,changeCurrentPassword)
router.route("/current-user").post(verifyJWT,getCurrentUser)
router.route("/update-details").patch(verifyJWT,updateAccoutDetails)

router.route("/change-user-avatar").patch(verifyJWT,upload.single("avatar"),updateUserAvatar)
router.route("/change-user-coverimg").patch(verifyJWT,upload.single("coverImg"),updateUserCoverImg)

router.route("/watch-history").get(verifyJWT,getWatchHistory)


export default router