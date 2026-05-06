const User = require("../models/User");

const createAdminIfNotExists = async () => {
  try {
    const admin = await User.findOne({ role: "admin" });

    if (!admin) {
      await User.create({
        username: "admin",
        email: "admin@factory.com",
        password: "admin123", // sẽ tự hash vì có pre("save")
        role: "admin",
        fullName: "System Administrator",
      });

      console.log("✅ Admin account created");
    } else {
      console.log("ℹ️ Admin already exists");
    }
  } catch (error) {
    console.error("❌ Error creating admin:", error.message);
  }
};

module.exports = createAdminIfNotExists;