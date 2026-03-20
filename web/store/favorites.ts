"use client";
import { create } from "zustand";
import type { Favorite } from "@/types";

interface FavoritesStore {
  favorites: Favorite[];
  setFavorites: (favs: Favorite[]) => void;
  addFavorite:  (fav: Favorite)    => void;
  removeFavorite: (id: string)     => void;
}

export const useFavoritesStore = create<FavoritesStore>()((set) => ({
  favorites: [],

  setFavorites: (favorites) => set({ favorites }),

  addFavorite: (fav) =>
    set((s) => ({ favorites: [fav, ...s.favorites] })),

  removeFavorite: (id) =>
    set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),
}));
