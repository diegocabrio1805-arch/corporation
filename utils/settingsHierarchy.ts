import { User, AppSettings, Role } from '../types';

export const resolveSettings = (
    currentUser: User | null,
    allSettings: Record<string, AppSettings>,
    allUsers: User[],
    defaultSettings: AppSettings
): AppSettings => {
    if (!currentUser) return defaultSettings;

    const SYSTEM_ADMIN_ID = 'b3716a78-fb4f-4918-8c0b-92004e3d63ec';
    const adminSettings = allSettings[SYSTEM_ADMIN_ID] || defaultSettings;

    // Base settings: start with global admin settings so all fields are populated
    let settings: AppSettings = { ...adminSettings };

    // Override with manager/branch settings if the current user has a branch
    const managerOrSelfId = (currentUser.role === Role.COLLECTOR && currentUser.managedBy)
        ? currentUser.managedBy
        : currentUser.id;

    // IMPORTANT: Strip isolated operational data if inheriting from the master admin.
    // This prevents branch A from seeing master admin's expenses/fuel history when branch A has not yet saved its own.
    if (managerOrSelfId !== SYSTEM_ADMIN_ID) {
        settings.isolatedExpenses = [];
        settings.fuelHistory = [];
        settings.defaultFuel = 0;
        settings.autoIsolatedFuelProjection = false;
        delete settings.isolatedProjectionAmount;
    }

    const branchSettings = allSettings[managerOrSelfId];
    const isValid = (val: any) => val && val !== '---' && val !== 'undefined' && String(val).trim() !== '';

    if (branchSettings) {
        settings = {
            ...settings,
            ...branchSettings,
            // CRITICAL: Ensure company fields don't inherit "---" or placeholders
            shareValue: isValid(branchSettings.shareValue) ? branchSettings.shareValue : (isValid(adminSettings.shareValue) ? adminSettings.shareValue : settings.shareValue),
            shareLabel: isValid(branchSettings.shareLabel) ? branchSettings.shareLabel : (isValid(adminSettings.shareLabel) ? adminSettings.shareLabel : settings.shareLabel),
            contactPhone: isValid(branchSettings.contactPhone) ? branchSettings.contactPhone : (isValid(adminSettings.contactPhone) ? adminSettings.contactPhone : settings.contactPhone),
            technicalSupportPhone: isValid(adminSettings.technicalSupportPhone) ? adminSettings.technicalSupportPhone : settings.technicalSupportPhone,
            companyIdentifier: isValid(branchSettings.companyIdentifier) ? branchSettings.companyIdentifier : (isValid(adminSettings.companyIdentifier) ? adminSettings.companyIdentifier : settings.companyIdentifier),
            companyName: isValid(branchSettings.companyName) ? branchSettings.companyName : (isValid(adminSettings.companyName) ? adminSettings.companyName : settings.companyName),
            companyAlias: isValid(branchSettings.companyAlias) ? branchSettings.companyAlias : (isValid(adminSettings.companyAlias) ? adminSettings.companyAlias : settings.companyAlias),
        };
    }

    return settings;
};

