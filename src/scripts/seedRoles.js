const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Role = require('../modules/auth/models/role.model');
const Permission = require('../modules/auth/models/permission.model');
const User = require('../modules/users/models/user.model');

const permissionsSeed = [
    { name: 'manage_courses', description: 'Create, update, and remove courses.' },
    { name: 'manage_assignments', description: 'Create and manage assignments for courses.' },
    { name: 'manage_contests', description: 'Create and manage contests.' },
    { name: 'manage_users', description: 'Manage users, roles, and account states.' },
    { name: 'view_analytics', description: 'View platform and learning analytics.' }
];

const rolePermissionMap = {
    'Super Admin': ['manage_courses', 'manage_assignments', 'manage_contests', 'manage_users', 'view_analytics'],
    'Admin': ['manage_courses', 'manage_assignments', 'manage_contests', 'manage_users', 'view_analytics'],
    'Instructor': ['manage_courses', 'manage_assignments', 'manage_contests', 'view_analytics'],
    'Student': ['view_analytics']
};

const seedRolesAndPermissions = async () => {
    try {
        if (!process.env.DATABASE_URL && !process.env.MONGO_URI) {
            throw new Error('DATABASE_URL (or MONGO_URI) is missing in .env');
        }

        const mongoUri = process.env.DATABASE_URL || process.env.MONGO_URI;
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const permissionDocsByName = {};
        for (const permission of permissionsSeed) {
            const doc = await Permission.findOneAndUpdate(
                { name: permission.name },
                { $set: permission },
                { new: true, upsert: true }
            );
            permissionDocsByName[permission.name] = doc;
        }
        console.log('✅ Permissions seeded');

        for (const [roleName, permissionNames] of Object.entries(rolePermissionMap)) {
            const permissionIds = permissionNames
                .map(name => permissionDocsByName[name])
                .filter(Boolean)
                .map(p => p._id);

            await Role.findOneAndUpdate(
                { name: roleName },
                { $set: { name: roleName, permissions: permissionIds } },
                { new: true, upsert: true }
            );
        }
        console.log('✅ Roles seeded');

        const superAdminEmail = 'ahmed.admin@nibras.com';
        const existingAdmin = await User.findOne({ email: superAdminEmail });

        if (!existingAdmin) {
            const superAdminRole = await Role.findOne({ name: 'Super Admin' });
            if (superAdminRole) {
                const hashedPassword = await bcrypt.hash('Admin@123', 10);
                await User.create({
                    name: 'Ahmed Elsayed Rabie',
                    email: superAdminEmail,
                    password: hashedPassword,
                    role: superAdminRole._id,
                    isVerified: true,
                    authProvider: 'manual'
                });
                console.log('🚀 Default Super Admin Created! (Email: ' + superAdminEmail + ')');
            } else {
                console.warn('⚠️ Super Admin role not found, skipping admin creation');
            }
        } else {
            console.log('✅ Super Admin already exists');
        }

        console.log('✅ RBAC Seeded Successfully');
        process.exit(0);

    } catch (error) {
        console.error('❌ Seeding Failed:', error);
        process.exit(1);
    }
};

seedRolesAndPermissions();