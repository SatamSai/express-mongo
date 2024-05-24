import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/apiError.js'
import {User} from '../models/user.model.js'
import {deleteFromCloudinary, uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/apiResponse.js'
import jwt, { decode } from 'jsonwebtoken'
import mongoose from 'mongoose'

const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        console.log("Generated access token is: ",+accessToken)

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    const {username, email, fullname, password} = req.body

    if([fullname,email,username,password].some(field => field?.trim() === "" || field===undefined)){
        throw new ApiError(400,"fullname is required")
    }
    
    const existedUser = await User.findOne({
        $or:[{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    console.log(req.files)

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatarImg = await uploadOnCloudinary(avatarLocalPath)
    let coverImg;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImg = req.files.coverImage[0].path
    }

    if(!avatarImg){
        throw new ApiError(400, "Avatar file is required")
    }

    const user = await User.create({
        username: username.toLowerCase(),
        fullname,
        email,
        avatar:avatarImg.url,
        coverImage:coverImg?.url || "",
        password
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully!")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    const {email, username, password} = req.body

    if(!(email || username)){
        throw new ApiError(400, "username or password is required!")
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiError(404, "user does not exist!")
    }

    const isCorrectPassword = await user.isPasswordCorrect(password)

    if(!isCorrectPassword){
        throw new ApiError(401,"Invalid user credentials!")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
    
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(200,{}, "User logged out!")
    )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken
        if(!incomingRefreshToken){
            throw new ApiError(401,"unauthorized request")
        }
        
        const decodedToken = await jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }
    
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ApiError(401,"Refresh token has expired or used")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {newAccessToken,newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken",newAccessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(200,
                {
                    newAccessToken,
                    refreshToken:newRefreshToken
                }, "Access token refreshed")
        )
    } catch (error) {
        throw new ApiError(401, "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req,res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old passwod!")
    }

    user.password = newPassword

    await user.save({validateBeforeSave:false})

    return res.status(200)
    .json(
        new ApiResponse(200, {} , "Password changed successfully!")
    )
})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res.status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"))
})

const updateAccoutDetails = asyncHandler(async(req,res) => {
    const {fullname,email} = req.body

    if(!fullname || !email){
        throw new ApiError(200, "All fields are required!")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email
            }
        },
        {
            new:true
        }
    ).select("-password -refreshToken")

    return res.status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully!"))
})

const updateUserAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing!")
    }

    const userInfo = await User.findById(req.user?._id)

    const userOldAvatarUrl = userInfo.avatar

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url) {
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    await deleteFromCloudinary(userOldAvatarUrl)

    return res.status(200)
    .json(new ApiResponse(200,user,"User Avatar updated successfully!"))
})

const updateUserCoverImg= asyncHandler(async(req,res) => {
    const coverImgLocalPath = req.file?.path

    if(!coverImgLocalPath){
        throw new ApiError(400,"Cover image file is missing!")
    }

    const coverImg = await uploadOnCloudinary(coverImgLocalPath)

    if(!coverImg.url) {
        throw new ApiError(400,"Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImg.url
            }
        },
        {
            new: true
        }
    ).select("-password -refreshToken")

    return res.status(200)
    .json(new ApiResponse(200,user,"Users cover image updated successfully!"))
})

const getUserChannelProfile = asyncHandler(async(req,res) => {
    console.log(req.query)
    const {username} = req.params

    if(!username){
        throw new ApiError(400,"username is missing!")
    }

    const channelInfo = await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField:"_id",
                foreignField: "subscriber",
                as: "subscriptions"
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField:"_id",
                foreignField: "channel",
                as: "channelSubscribers"
            }
        },
        {
            $addFields:{
                channelsSubscriptions:{
                    $size:"$subscriptions"
                },
                isCurrentUserSubscribed:{
                    $cond:{
                        if:{$in: [req.user?._id,"$channelSubscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                subscribers: 1,
                channelsSubscriptions: 1,
                isCurrentUserSubscribed: 1,
                email:1,
            }
        }
    ])

    if(!channelInfo?.length>0){
        throw new ApiError(400,"channel not found!")
    }

    
    return res.status(200)
    .json(new ApiResponse(200,channelInfo[0],"Channel fetched successfully!"))
})

const getWatchHistory = asyncHandler( async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname: 1,
                                        username:1,
                                        avatar:1
                                    },
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(200, user[0].watchHistory,"Watch history fetched successfully!")
    )
})

export {
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccoutDetails, 
    updateUserCoverImg, 
    updateUserAvatar, 
    getUserChannelProfile,
    getWatchHistory
}