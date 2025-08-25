import mongoose, { Schema } from "mongoose";
import mediaSchema from './Media.js'

const promoSchema = new Schema({
    text: String,
    url: String,
    text2: String,
    url2: String,
    text3: String,
    url3: String,
    showPromo: Boolean
}, { _id: false });

const themeSchema = new Schema({
    fontFamily: { type: String, default: "Inter, sans-serif" },
    primaryColor: { type: String, default: "#1d4ed8" },
    secondaryColor: { type: String, default: "#9333ea" },
    backgroundColor: { type: String, default: "#ffffff" },
    textColor: { type: String, default: "#000000" },
    fontSize: { type: String, default: "16px" },
    fontWeight: { type: String, default: "400" }
}, { _id: false });


const comingSoonSchema = new Schema({
    enabled: { type: Boolean, default: false },
    password: { type: String, default: "" },
    message: { type: String, default: "Website Coming Soon" },
    reason: { type: String, default: "" },
    allowBypass: { type: Boolean, default: true }
}, { _id: false });

const headerInnerSchema = new Schema({
    promo: promoSchema,
    showSearchBox: Boolean,
    headerMenu: [Schema.Types.Mixed]
}, { _id: false });

const headerConfigSchema = new Schema({
    scripts: {
        header: String,
        body: String
    },
    header: headerInnerSchema,
    isMaintenanceModeEnabled: Boolean,
    siteTitle: String,
    siteEmail: String,
    sitePhone: Number,
    siteAddress: String,
    adminLogo: { type: Schema.Types.ObjectId, ref: 'Media' },
    websiteLogo: { type: Schema.Types.ObjectId, ref: 'Media' },
    favicon: { type: Schema.Types.ObjectId, ref: 'Media' },
    loginPageImg: { type: Schema.Types.ObjectId, ref: 'Media' },
}, { _id: false });

const featureSetSchema = new Schema({
    title: String,
    subtitle: String,
    url: String,
    image: { type: Schema.Types.ObjectId, ref: 'Media' }
}, { _id: false });

const footerInnerSchema = new Schema({
    button: {
        text: String,
        url: String,
        showButton: Boolean
    },
    featureSets: {
        one: featureSetSchema,
        two: featureSetSchema,
        three: featureSetSchema,
        four: featureSetSchema
    },
    showEmailSubscribe: Boolean,
    footerMenu: [Schema.Types.Mixed]
}, { _id: false });

const footerConfigSchema = new Schema({
    scripts: {
        footer: String
    },
    logo: { type: Schema.Types.ObjectId, ref: 'Media' },
    socialLinks: {
        facebook: String,
        twitter: String,
        instagram: String,
        youtube: String,
        linkedin: String
    },
    footer: footerInnerSchema,
    copyright: String,
    showCopyright: Boolean
}, { _id: false });

const siteConfigSchema = new Schema({
    header: [headerConfigSchema],
    footer: [footerConfigSchema],
    comingSoon: comingSoonSchema,
    theme: themeSchema,
    error: Boolean
});

const SiteConfig = mongoose.model("SiteConfig", siteConfigSchema);
export default SiteConfig;
