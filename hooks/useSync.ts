import { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { Client, PaymentRecord, Loan, CollectionLog, User, AppState, AppSettings, Expense, DeletedItem } from '../types';
import { StorageService } from '../utils/localforageStorage';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';


const isValidUuid = (id: string | undefined | null) => {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || (id.length > 20 && id.includes('-'));
};

export const useSync = (onDataUpdated?: (newData: Partial<AppState>, isFullSync?: boolean) => void) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [isFullSyncing, setIsFullSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState("-íSincronizado!");
    const [isOnline, setIsOnline] = useState(true);
    const [queueLength, setQueueLength] = useState(0);
    const [lastErrors, setLastErrors] = useState<{ table: string, error: any, timestamp: string }[]>([]);
    const isProcessingRef = useRef(false);

    // Checks for internet connection
    const checkConnection = async (): Promise<boolean> => {
        try {
            const status = await Network.getStatus();
            if (status.connected === false) return false;

            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                return false;
            }

            return true;
        } catch (error) {
            return typeof navigator !== 'undefined' ? navigator.onLine : true;
        }
    };

    useEffect(() => {
        const initNetwork = async () => {
            const online = await checkConnection();
            setIsOnline(online);
            if (online) {
                processQueue();
            }
        };

        initNetwork();

        // Check periodically (every 10s instead of 30s) for aggressive sync
        const interval = setInterval(async () => {
            const online = await checkConnection();
            if (online !== isOnline) setIsOnline(online);
            if (online) {
                const queueStr = localStorage.getItem('syncQueue');
                if (queueStr && JSON.parse(queueStr || '[]').length > 0) {
                    processQueue();
                }
            }
        }, 10000);

        const setupListener = async () => {
            const handler = await Network.addListener('networkStatusChange', async (status) => {
                console.log('Network status changed (System)', status);
                setTimeout(async () => {
                    const online = await checkConnection();
                    setIsOnline(online);
                    if (online) {
                        processQueue();
                    }
                }, 200);
            });
            return handler;
        };

        const setupAppListener = async () => {
            return await App.addListener('appStateChange', async ({ isActive }) => {
                if (isActive) {
                    const online = await checkConnection();
                    setIsOnline(online);

                    if (online) {
                        const queueStr = localStorage.getItem('syncQueue');
                        const hasPending = queueStr && JSON.parse(queueStr || '[]').length > 0;

                        const lastSyncTime = localStorage.getItem('last_sync_timestamp_ms');
                        const timeSinceLastSync = lastSyncTime ? Date.now() - parseInt(lastSyncTime) : 9999999;

                        if (hasPending) {
                            console.log('App resumed: Uploading pending items...');
                            processQueue(false);
                        } else if (timeSinceLastSync > 120000) {
                            console.log('App resumed: Syncing (Stale data > 2min)');
                            processQueue(true);
                        }
                    }
                }
            });
        };

        // REALTIME SUBSCRIPTION FOR INSTANT UPDATES
        let channel: any = null;
        let reconnectTimeout: any = null;

        const subscribeToRealtime = () => {
            if (channel) {
                supabase.removeChannel(channel);
            }

            channel = supabase.channel('system_changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public' },
                    async (payload) => {
                        const isDeleteEvent = payload.eventType === 'DELETE';
                        const isCriticalTable = ['collection_logs', 'payments', 'loans', 'clients', 'deleted_items', 'expenses'].includes(payload.table);

                        const triggerSync = async () => {
                            try {
                                const newData = await pullData(false);
                                if (newData && onDataUpdated) {
                                    onDataUpdated(newData, false);
                                }
                            } catch (error) {
                                console.error("[Realtime] Sync trigger failed:", error);
                            }
                        };

                        if (isDeleteEvent && isCriticalTable) {
                            triggerSync();
                        } else {
                            const debounceTimer = (window as any)._syncDebounceTimer;
                            if (debounceTimer) clearTimeout(debounceTimer);
                            (window as any)._syncDebounceTimer = setTimeout(triggerSync, 1000);
                        }
                    }
                )
                .subscribe((status) => {
                    (window as any)._lastRealtimeStatus = status;

                    if (status === 'SUBSCRIBED') {
                        if (reconnectTimeout) {
                            clearTimeout(reconnectTimeout);
                            reconnectTimeout = null;
                        }

                        if ((window as any)._rtHeartbeat) clearInterval((window as any)._rtHeartbeat);
                        (window as any)._rtHeartbeat = setInterval(() => {
                            if (channel && channel.state === 'joined') {
                                channel.send({ type: 'broadcast', event: 'heartbeat', payload: { t: Date.now() } });
                            }
                        }, 45000);

                        const lastSyncTime = localStorage.getItem('last_sync_timestamp_ms');
                        const shouldPull = !lastSyncTime || (Date.now() - parseInt(lastSyncTime)) > 120000;
                        if (shouldPull) {
                            pullData(false).then(newData => {
                                if (newData && onDataUpdated) onDataUpdated(newData);
                            });
                        }
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                        if ((window as any)._rtHeartbeat) clearInterval((window as any)._rtHeartbeat);
                        if (!reconnectTimeout) {
                            reconnectTimeout = setTimeout(() => {
                                reconnectTimeout = null;
                                subscribeToRealtime();
                            }, 5000);
                        }
                    }
                });
        };

        const healthCheckInterval = setInterval(() => {
            const status = (window as any)._lastRealtimeStatus;
            if (status !== 'SUBSCRIBED') {
                subscribeToRealtime();
            }
        }, 120000);

        subscribeToRealtime();

        const handlerPromise = setupListener();
        const appHandlerPromise = setupAppListener();

        return () => {
            clearInterval(interval);
            clearInterval(healthCheckInterval);
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            handlerPromise.then(h => h.remove());
            appHandlerPromise.then(h => h.remove());
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    const addToQueue = (operation: string, data: any) => {
        let queue = JSON.parse(localStorage.getItem('syncQueue') || '[]');

        if (operation === 'UPDATE_SETTINGS') {
            queue = queue.filter((item: any) => item.operation !== 'UPDATE_SETTINGS' || item.data.branchId !== data.branchId);
        }

        if (operation === 'ADD_LOG') {
            const isDuplicate = queue.some((item: any) =>
                item.operation === 'ADD_LOG' &&
                item.data.loanId === data.loanId &&
                item.data.amount === data.amount &&
                item.data.type === data.type &&
                (Date.now() - item.timestamp < 2000)
            );
            if (isDuplicate) return;
        }

        queue.push({ operation, data, timestamp: Date.now() });
        localStorage.setItem('syncQueue', JSON.stringify(queue));
        setQueueLength(queue.length);

        // Instant sync trigger
        processQueue();
    };

    const forceSync = () => processQueue(true);
    const forceFullSync = () => processQueue(true, true);

    const pullData = async (fullSync = false): Promise<Partial<AppState> | null> => {
        setIsSyncing(true);
        setSyncError(null);
        try {
            const online = await checkConnection();
            if (!online) return null;

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setSyncError('Sesión caducada.');
                return null;
            }

            const lastSyncTime = localStorage.getItem('last_sync_timestamp_v8');
            const PAGE_SIZE = 500;

            const fetchAll = async (query: any) => {
                let allData: any[] = [];
                let page = 0;
                let hasMore = true;

                while (hasMore) {
                    let attempts = 0;
                    let success = false;

                    while (attempts < 3 && !success) {
                        try {
                            const { data, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
                            if (error) throw error;

                            if (data && data.length > 0) {
                                allData = allData.concat(data);
                                if (data.length < PAGE_SIZE) hasMore = false;
                                else page++;
                            } else {
                                hasMore = false;
                            }
                            success = true;
                        } catch (err: any) {
                            attempts++;
                            await new Promise(r => setTimeout(r, 1000 * attempts));
                            if (attempts >= 3) throw err;
                        }
                    }
                    await new Promise(r => setTimeout(r, 50));
                    if (page > 100) break;
                }
                return { data: allData, error: null };
            };

            let clientsQuery = supabase.from('clients').select('id, document_id, name, phone, secondary_phone, address, added_by, branch_id, location, domicilio_location, credit_limit, allow_collector_location_update, custom_no_pay_message, is_active, is_hidden, created_at, updated_at, deleted_at, capital, current_balance');
            let loansQuery = supabase.from('loans').select('*');
            let paymentsQuery = supabase.from('payments').select('*');
            let logsQuery = supabase.from('collection_logs').select('*');
            let profilesQuery = supabase.from('profiles').select('*');
            let settingsQuery = supabase.from('branch_settings').select('*');
            let expensesQuery = supabase.from('expenses').select('*');
            let deletedItemsQuery = supabase.from('deleted_items').select('*');

            let adjustedSyncTime: string | null = null;
            if (lastSyncTime && !fullSync) {
                const safetyMargin = 120000;
                const parsedDate = new Date(lastSyncTime);
                if (!isNaN(parsedDate.getTime())) {
                    adjustedSyncTime = new Date(parsedDate.getTime() - safetyMargin).toISOString();
                } else {
                    fullSync = true;
                }
            }

            if (adjustedSyncTime && !fullSync) {
                clientsQuery = clientsQuery.gt('updated_at', adjustedSyncTime);
                loansQuery = loansQuery.gt('updated_at', adjustedSyncTime);
                paymentsQuery = paymentsQuery.gt('updated_at', adjustedSyncTime);
                logsQuery = logsQuery.gt('updated_at', adjustedSyncTime);
                profilesQuery = profilesQuery.gt('updated_at', adjustedSyncTime);
                settingsQuery = settingsQuery.gt('updated_at', adjustedSyncTime);
                expensesQuery = expensesQuery.gt('updated_at', adjustedSyncTime);
                deletedItemsQuery = deletedItemsQuery.gt('deleted_at', adjustedSyncTime);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);

            const settingsResult = await fetchAll(settingsQuery.abortSignal(controller.signal));
            const profilesResult = await fetchAll(profilesQuery.abortSignal(controller.signal));
            const clientsResult = await fetchAll(clientsQuery.abortSignal(controller.signal));
            const loansResult = await fetchAll(loansQuery.abortSignal(controller.signal));
            const paymentsResult = await fetchAll(paymentsQuery.abortSignal(controller.signal));
            const logsResult = await fetchAll(logsQuery.abortSignal(controller.signal));
            const expensesResult = await fetchAll(expensesQuery.abortSignal(controller.signal));
            const deletedResult = await fetchAll(deletedItemsQuery.abortSignal(controller.signal));

            clearTimeout(timeoutId);

            localStorage.setItem('last_sync_timestamp_ms', new Date().getTime().toString());
            localStorage.setItem('last_sync_timestamp_v8', new Date().toISOString());

            const result = {
                clients: (clientsResult.data || []).map((c: any) => ({
                    ...c, documentId: c.document_id, secondaryPhone: c.secondary_phone,
                    profilePic: c.profile_pic, housePic: c.house_pic, businessPic: c.business_pic,
                    documentPic: c.document_pic, domicilioLocation: c.domicilio_location,
                    creditLimit: c.credit_limit, allowCollectorLocationUpdate: c.allow_collector_location_update,
                    customNoPayMessage: c.custom_no_pay_message, isActive: c.is_active, isHidden: c.is_hidden,
                    addedBy: c.added_by, branchId: c.branch_id, createdAt: c.created_at, deletedAt: c.deleted_at
                })) as Client[],
                loans: (loansResult.data || []).map((l: any) => ({
                    ...l, clientId: l.client_id, collectorId: l.collector_id, branchId: l.branch_id,
                    interestRate: l.interest_rate, totalInstallments: l.total_installments,
                    totalAmount: l.total_amount, installmentValue: l.installment_value,
                    createdAt: l.created_at, deletedAt: l.deleted_at, installments: l.installments,
                    isRenewal: l.is_renewal || false, frequency: l.frequency
                })) as Loan[],
                payments: (paymentsResult.data || []).map((p: any) => ({
                    ...p, loanId: p.loan_id, clientId: p.client_id, branchId: p.branch_id,
                    installmentNumber: p.installment_number, isVirtual: p.is_virtual,
                    isRenewal: p.is_renewal, deletedAt: p.deleted_at
                })) as PaymentRecord[],
                collectionLogs: (logsResult.data || []).map((cl: any) => ({
                    ...cl, loanId: cl.loan_id, clientId: cl.client_id, branchId: cl.branch_id,
                    isVirtual: cl.is_virtual, isRenewal: cl.is_renewal, isOpening: cl.is_opening,
                    recordedBy: cl.recorded_by, deletedAt: cl.deleted_at
                })) as CollectionLog[],
                expenses: (expensesResult.data || []).map((e: any) => ({ ...e, branchId: e.branch_id, addedBy: e.added_by })) as Expense[],
                users: (profilesResult.data || []).map((u: any) => ({ ...u, expiryDate: u.expiry_date, managedBy: u.managed_by, requiresLocation: u.requires_location })) as unknown as User[],
                branchSettings: (settingsResult.data || []).reduce((acc: any, s: any) => {
                    acc[s.id] = s.settings;
                    return acc;
                }, {} as Record<string, AppSettings>),
                deletedItems: (deletedResult.data || []).map((d: any) => ({ id: d.id, tableName: d.table_name, recordId: d.record_id, branchId: d.branch_id, deletedAt: d.deleted_at })) as DeletedItem[]
            };

            if (onDataUpdated) onDataUpdated(result, fullSync);
            return result;
        } catch (err: any) {
            setSyncError(`Error Descarga: ${err.message || 'Error'}`);
            return null;
        } finally {
            setIsSyncing(false);
            if (fullSync) setIsFullSyncing(false);
        }
    };

    const fetchClientPhotos = async (clientId: string): Promise<Partial<Client> | null> => {
        try {
            const { data, error } = await supabase.from('clients').select('profile_pic, house_pic, business_pic, document_pic').eq('id', clientId).single();
            if (error) throw error;
            return { profilePic: data.profile_pic, housePic: data.house_pic, businessPic: data.business_pic, documentPic: data.document_pic };
        } catch (err) { return null; }
    };

    const processQueue = async (force = false, fullSync = false) => {
        if (isProcessingRef.current && !force) return;
        isProcessingRef.current = true;
        try {
            const online = await checkConnection();
            setIsOnline(online);
            if (!online) {
                setSyncError('Sin conexión. Reintentando pronto...');
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setSyncError('Sesión requerida.');
                return;
            }

            const queue = JSON.parse(localStorage.getItem('syncQueue') || '[]');
            setQueueLength(queue.length);

            if (queue.length === 0) {
                if (force || fullSync) pullData(fullSync);
                setIsSyncing(false);
                isProcessingRef.current = false;
                return;
            }

            setIsSyncing(true);
            const groups: Record<string, any[]> = {
                'ADD_CLIENT': [], 'ADD_LOAN': [], 'ADD_PAYMENT': [], 'ADD_LOG': [],
                'ADD_EXPENSE': [], 'ADD_PROFILE': [], 'UPDATE_SETTINGS': [],
                'DELETE_LOG': [], 'DELETE_PAYMENT': [], 'DELETE_LOAN': [], 'DELETE_CLIENT': [], 'DELETE_EXPENSE': []
            };

            const processedIndices = new Set<number>();
            queue.forEach((item: any, index: number) => {
                if (groups[item.operation]) groups[item.operation].push({ item, index });
            });

            const batchUpsert = async (table: string, itemsWithIndex: any[], mapper: (d: any) => any) => {
                if (itemsWithIndex.length === 0) return;
                const CHUNK_SIZE = 5;
                for (let i = 0; i < itemsWithIndex.length; i += CHUNK_SIZE) {
                    const chunk = itemsWithIndex.slice(i, i + CHUNK_SIZE);
                    const dataToUpsert = chunk.map(x => mapper(x.item.data));
                    try {
                        const { error } = await supabase.from(table).upsert(dataToUpsert);
                        if (error) throw error;
                        chunk.forEach(x => processedIndices.add(x.index));
                    } catch (err) { console.error(`Sync error:`, err); }
                }
            };

            await batchUpsert('profiles', groups['ADD_PROFILE'], (d) => ({
                id: d.id,
                name: d.name,
                username: d.username,
                password: d.password,
                role: d.role,
                blocked: d.blocked,
                expiry_date: !d.expiryDate || d.expiryDate === '' ? null : d.expiryDate,
                managed_by: !d.managedBy || d.managedBy === '' ? null : d.managedBy,
                profile_pic: d.profilePic,
                home_pic: d.homePic,
                home_location: d.homeLocation,
                requires_location: d.requiresLocation,
                deleted_at: d.deletedAt || null,
                updated_at: new Date().toISOString()
            }));
            await batchUpsert('clients', groups['ADD_CLIENT'], (d) => ({
                id: d.id,
                name: d.name,
                document_id: d.documentId,
                phone: d.phone,
                secondary_phone: d.secondaryPhone,
                address: d.address,
                profile_pic: d.profilePic,
                house_pic: d.housePic,
                business_pic: d.businessPic,
                document_pic: d.documentPic,
                domicilio_location: d.domicilioLocation,
                location: d.location,
                credit_limit: d.creditLimit,
                allow_collector_location_update: d.allowCollectorLocationUpdate,
                added_by: d.addedBy,
                branch_id: d.branchId,
                is_active: d.isActive !== undefined ? d.isActive : true,
                is_hidden: d.isHidden || false,
                deleted_at: d.deletedAt || null,
                created_at: d.createdAt,
                updated_at: new Date().toISOString()
            }));
            await batchUpsert('loans', groups['ADD_LOAN'], (d) => ({
                id: d.id,
                client_id: d.clientId,
                collector_id: d.collectorId,
                branch_id: d.branchId,
                principal: d.principal,
                interest_rate: d.interestRate,
                total_installments: d.totalInstallments,
                installment_value: d.installmentValue,
                total_amount: d.totalAmount,
                status: d.status,
                created_at: d.createdAt,
                installments: d.installments,
                frequency: d.frequency,
                is_renewal: d.isRenewal || false,
                custom_holidays: d.customHolidays || [],
                deleted_at: d.deletedAt || null,
                updated_at: new Date().toISOString()
            }));
            await batchUpsert('payments', groups['ADD_PAYMENT'], (d) => ({
                id: d.id,
                loan_id: d.loanId,
                client_id: d.clientId,
                collector_id: d.collectorId,
                branch_id: d.branchId,
                amount: d.amount,
                date: d.date,
                installment_number: d.installmentNumber,
                location: d.location,
                is_virtual: d.isVirtual || false,
                is_renewal: d.isRenewal || false,
                deleted_at: d.deletedAt || null,
                updated_at: new Date().toISOString()
            }));
            await batchUpsert('collection_logs', groups['ADD_LOG'], (d) => ({
                id: d.id,
                loan_id: d.loanId,
                client_id: d.clientId,
                branch_id: d.branchId,
                collector_id: d.collectorId,
                recorded_by: d.recordedBy,
                amount: d.amount,
                type: d.type,
                date: d.date,
                location: d.location,
                notes: d.notes,
                is_virtual: d.isVirtual || false,
                is_renewal: d.isRenewal || false,
                is_opening: d.isOpening || false,
                deleted_at: d.deletedAt || null,
                updated_at: new Date().toISOString()
            }));
            await batchUpsert('expenses', groups['ADD_EXPENSE'], (d) => ({
                id: d.id,
                description: d.description,
                amount: d.amount,
                category: d.category,
                date: d.date,
                branch_id: d.branchId,
                added_by: d.addedBy,
                deleted_at: d.deletedAt || null,
                updated_at: new Date().toISOString()
            }));

            const newQueue = queue.filter((_: any, index: number) => !processedIndices.has(index));
            localStorage.setItem('syncQueue', JSON.stringify(newQueue));
            setQueueLength(newQueue.length);

            if (newQueue.length > 0) {
                setSyncError(`Pendientes: ${newQueue.length}. Reintentando automáticamente...`);
                setTimeout(() => processQueue(true), 5000);
            } else {
                setSyncError(null);
                pullData(fullSync);
            }
        } catch (err) { setSyncError("Error sincronización."); } finally {
            isProcessingRef.current = false;
            setIsSyncing(false);
        }
    };

    const pushClient = async (client: Client): Promise<boolean> => { addToQueue('ADD_CLIENT', client); return true; };
    const pushLoan = async (loan: Loan): Promise<boolean> => { addToQueue('ADD_LOAN', loan); return true; };
    const pushPayment = async (payment: PaymentRecord): Promise<boolean> => { addToQueue('ADD_PAYMENT', payment); return true; };
    const pushLog = async (log: CollectionLog): Promise<boolean> => { addToQueue('ADD_LOG', log); return true; };
    const pushUser = async (user: User): Promise<boolean> => { addToQueue('ADD_PROFILE', user); return true; };

    const pushSettings = async (branchId: string, settings: AppSettings): Promise<boolean> => {
        addToQueue('UPDATE_SETTINGS', { branchId, settings });
        return true;
    };

    const deleteRemoteLog = async (logId: string) => addToQueue('DELETE_LOG', { id: logId });
    const deleteRemotePayment = async (paymentId: string) => addToQueue('DELETE_PAYMENT', { id: paymentId });
    const deleteRemoteLoan = async (loanId: string) => addToQueue('DELETE_LOAN', { id: loanId });
    const deleteRemoteClient = async (clientId: string) => addToQueue('DELETE_CLIENT', { id: clientId });
    const clearQueue = () => { localStorage.removeItem('syncQueue'); setSyncError(null); setIsSyncing(false); };

    return {
        isSyncing, isFullSyncing, syncError, showSuccess, successMessage, setSuccessMessage, isOnline,
        processQueue, forceSync, forceFullSync, pullData, pushClient, pushLoan, pushPayment, pushLog,
        pushUser, pushSettings, clearQueue, deleteRemoteLoan, deleteRemoteLog, deleteRemotePayment,
        deleteRemoteClient, fetchClientPhotos, supabase, queueLength, addToQueue, lastErrors, setLastErrors
    };
};
