/* Stub universel pour @tabler/icons-react-native dans les bundles de tests :
   n'importe quelle icône nommée devient un composant no-op. */
module.exports = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "__esModule") return false;
      return function TablerIconStub() {
        return null;
      };
    },
  }
);
