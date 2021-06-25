import create from 'zustand';

export const useStore = create(set => ({
    isLoggedIn: { initialised: false, value: false },
    setIsLoggedIn: (loggedIn: boolean, initialized = true) => set({isLoggedIn: {initialized, value: loggedIn}})
}));
