import AsyncStorage from "@react-native-async-storage/async-storage";
import { createRecoverableStorage } from "./persistQueue";

export const durableStorage = createRecoverableStorage(AsyncStorage);
export default durableStorage;
